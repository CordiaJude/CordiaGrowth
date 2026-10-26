import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { isPublicIp } from "./ip";

export class UnsafeTargetError extends Error {}

/**
 * DNS lookup that refuses non-public addresses. Used as the connect-time
 * resolver so every connection (including each redirect hop) is checked, which
 * also defeats DNS-rebinding between a pre-check and the real request.
 */
export function safeLookup(
  hostname: string,
  options: { all?: boolean; family?: number } | undefined,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { all: true, family: options?.family ?? 0 }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => !isPublicIp(a.address));
    if (bad || list.length === 0) {
      return callback(new UnsafeTargetError(`Refusing to connect to non-public address for ${hostname}`), []);
    }
    if (options?.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({
  connect: { lookup: safeLookup as never, timeout: 10_000 },
  headersTimeout: 15_000,
  bodyTimeout: 20_000,
});

export const CRAWLER_USER_AGENT = "CordiaGrowthBot/0.1 (+https://github.com/cordiajude/cordiagrowth)";

export type SafeFetchResult = {
  url: string;
  status: number;
  headers: Headers;
  redirects: { url: string; status: number }[];
  body: string;
  bytes: number;
  truncated: boolean;
  elapsedMs: number;
};

/**
 * GET a public http(s) URL with manual redirect handling, a size cap and a
 * total timeout. Only for fetching customer/competitor sites from jobs.
 */
export async function safeFetch(
  input: string,
  opts: { maxRedirects?: number; maxBytes?: number; timeoutMs?: number } = {},
): Promise<SafeFetchResult> {
  const { maxRedirects = 5, maxBytes = 5 * 1024 * 1024, timeoutMs = 20_000 } = opts;
  const started = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);
  const redirects: { url: string; status: number }[] = [];
  let url = new URL(input);

  for (let hop = 0; ; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new UnsafeTargetError(`Unsupported protocol: ${url.protocol}`);
    }
    // IP-literal hosts skip DNS, so the connect-time lookup never sees them.
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !isPublicIp(literal)) {
      throw new UnsafeTargetError(`Refusing to connect to non-public address ${literal}`);
    }
    const res = await undiciFetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal,
      headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/html,*/*;q=0.8" },
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      redirects.push({ url: url.toString(), status: res.status });
      if (hop >= maxRedirects) throw new Error(`Too many redirects (>${maxRedirects})`);
      url = new URL(location, url);
      continue;
    }

    const { text, bytes, truncated } = await readCapped(
      res.body as ReadableStream<Uint8Array> | null,
      maxBytes,
    );
    return {
      url: url.toString(),
      status: res.status,
      headers: res.headers as unknown as Headers,
      redirects,
      body: text,
      bytes,
      truncated,
      elapsedMs: Math.round(performance.now() - started),
    };
  }
}

async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  if (!body) return { text: "", bytes: 0, truncated: false };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), bytes, truncated };
}
