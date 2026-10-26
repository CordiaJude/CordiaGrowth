import { aiConfig } from "../../config/ai";

export type Usage = { inputTokens: number; outputTokens: number; searchRequests: number };

export type ModelPrice = {
  /** USD per 1M input tokens. */
  inputPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
  /** USD per web search / grounded query, if billed separately. */
  perSearch?: number;
  /** USD flat fee per request (e.g. Perplexity request fees). */
  perRequest?: number;
};

/** Longest-prefix price lookup so "gpt-x-2026-01-01" finds "gpt-x". */
export function priceFor(
  model: string,
  table: Record<string, ModelPrice> = aiConfig().pricing,
): ModelPrice | null {
  if (table[model]) return table[model];
  const key = Object.keys(table)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : null;
}

/** USD cost of one call. Unknown models cost 0 but are logged by callers. */
export function costFor(model: string, usage: Usage, table?: Record<string, ModelPrice>): number {
  const p = priceFor(model, table);
  if (!p) return 0;
  const cost =
    (usage.inputTokens / 1_000_000) * p.inputPerM +
    (usage.outputTokens / 1_000_000) * p.outputPerM +
    usage.searchRequests * (p.perSearch ?? 0) +
    (p.perRequest ?? 0);
  return Math.round(cost * 1_000_000) / 1_000_000;
}
