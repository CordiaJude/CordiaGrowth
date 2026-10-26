import { isIP } from "node:net";

export type DomainResult = { ok: true; domain: string } | { ok: false; error: string };

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
  ".test",
  ".invalid",
  ".example",
];

/**
 * Normalizes user input ("https://www.Example.com/about") to a bare host
 * ("example.com"): lowercase, punycode, no scheme/port/path, no "www.".
 * Rejects IP literals and non-public names; sites are identified by domain.
 */
export function normalizeDomain(input: string): DomainResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a domain, like example.com" };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "That doesn't look like a valid domain" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https sites are supported" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Remove the username/password from the address" };
  }

  let host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") || isIP(host)) {
    return { ok: false, error: "Use a domain name, not an IP address" };
  }
  if (host.startsWith("www.")) host = host.slice(4);

  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: "Use a public domain name" };
  }
  const labels = host.split(".");
  if (labels.length < 2 || labels.some((l) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) {
    return { ok: false, error: "That doesn't look like a valid domain" };
  }
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels.at(-1)!)) {
    return { ok: false, error: "That doesn't look like a valid domain" };
  }
  if (host.length > 253) return { ok: false, error: "Domain is too long" };

  return { ok: true, domain: host };
}
