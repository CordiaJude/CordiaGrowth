/** Hostname without "www.", lowercased, or null for non-http(s) / invalid URLs. */
export function domainOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

// Tracking params that make the same page look like different URLs.
const TRACKING_PARAMS = /^(utm_[a-z]+|gclid|fbclid|msclkid|ref|ref_src|srsltid)$/i;

/** Canonical form for de-duplication: https-agnostic, no fragment or tracking params. */
export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.toLowerCase();
    let out = u.toString();
    if (u.pathname === "/" && !u.search) out = out.replace(/\/$/, "");
    return out;
  } catch {
    return null;
  }
}

/** Bare http(s) URLs and markdown links found in answer text. */
export function extractUrlsFromText(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>()[\]"'`]+/g) ?? [];
  return found.map((u) => u.replace(/[.,;:!?*_]+$/, ""));
}

/** Unique normalized URLs (in first-seen order) and their unique domains. */
export function collectCitations(urls: Iterable<string>): { urls: string[]; domains: string[] } {
  const seen = new Set<string>();
  const domains = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = normalizeUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    const d = domainOf(url);
    if (d) domains.add(d);
  }
  return { urls: out, domains: [...domains] };
}

/** True when `domain` is `base` or a subdomain of it. */
export function domainMatches(domain: string, base: string): boolean {
  const d = domain.toLowerCase();
  const b = base.toLowerCase().replace(/^www\./, "");
  return d === b || d.endsWith(`.${b}`);
}
