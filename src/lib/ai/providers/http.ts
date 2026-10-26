import { ProviderError } from "./types";

/**
 * POST JSON to a provider API with a timeout. Classifies failures so the run
 * retries rate limits / overloads but not auth, billing or bad requests.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  opts: { timeoutMs?: number; provider: string; fetchImpl?: typeof fetch } = { provider: "provider" },
): Promise<T> {
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
    });
  } catch (e) {
    throw new ProviderError(`${opts.provider}: network error (${(e as Error).message})`, true);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    let code = "";
    try {
      const j = JSON.parse(text);
      const err = j.error ?? j;
      detail = String(err.message ?? detail);
      code = String(err.code ?? err.type ?? err.status ?? "");
    } catch {
      // keep raw text
    }
    // Billing/quota-exhausted 429s won't succeed on retry.
    const billing = /credit|quota|billing|spend_limit|usage_limit|insufficient/i.test(code + " " + detail);
    const retryable = !billing && (res.status === 429 || res.status === 408 || res.status >= 500);
    throw new ProviderError(
      `${opts.provider}: HTTP ${res.status}${code ? ` ${code}` : ""}: ${detail}`,
      retryable,
      res.status,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError(`${opts.provider}: invalid JSON response`, true, res.status);
  }
}
