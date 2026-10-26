/**
 * Wilson score interval for a binomial proportion. Used so that every
 * mention rate is shown with its uncertainty: 1 of 3 samples is "33%
 * (6–79%)", not a fact.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export type RateSummary = {
  samples: number;
  hits: number;
  rate: number | null;
  low: number | null;
  high: number | null;
};

export function summarizeRate(hits: number, samples: number): RateSummary {
  if (samples <= 0) return { samples: 0, hits: 0, rate: null, low: null, high: null };
  const { low, high } = wilsonInterval(hits, samples);
  return { samples, hits, rate: hits / samples, low, high };
}

/** Share of voice: our mentions / (ours + tracked competitors' mentions). */
export function shareOfVoice(brandMentions: number, competitorMentions: number): number | null {
  const total = brandMentions + competitorMentions;
  return total > 0 ? brandMentions / total : null;
}

export function formatPct(value: number | null, digits = 0): string {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}
