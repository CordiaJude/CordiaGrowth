/**
 * Deterministic brand detection used to cross-check the LLM parser: if the
 * answer literally contains our brand name or alias, it was mentioned.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalizes curly quotes/dashes and collapses whitespace for matching. */
function normalizeText(s: string): string {
  return s.normalize("NFKC").replace(/[‘’ʼ]/g, "'").replace(/[‐-―]/g, "-").replace(/\s+/g, " ");
}

/** Whole-word, case-insensitive match of any name in the text. */
export function mentionsAny(text: string, names: string[]): boolean {
  const haystack = normalizeText(text);
  return names
    .map((n) => normalizeText(n).trim())
    .filter((n) => n.length >= 2)
    .some((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(n)}($|[^\\p{L}\\p{N}])`, "iu").test(haystack));
}

/** Names that identify a brand, including the domain's first label ("acme" for acme.com). */
export function brandNames(brand: { name: string; aliases?: string[]; domains?: string[] }): string[] {
  const names = new Set<string>([brand.name, ...(brand.aliases ?? [])]);
  for (const d of brand.domains ?? []) {
    names.add(d);
  }
  return [...names].filter(Boolean);
}
