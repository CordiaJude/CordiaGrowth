export type Frequency = "daily" | "weekly" | "monthly" | "manual";

const HOUR = 3600_000;
// Slightly under the nominal period so an hourly cron doesn't drift later each cycle.
const PERIOD: Record<Exclude<Frequency, "manual">, number> = {
  daily: 23 * HOUR,
  weekly: (7 * 24 - 4) * HOUR,
  monthly: (28 * 24 - 4) * HOUR,
};

/** Whether a scheduled run is due, given the last run of any kind (manual runs count). */
export function isDue(frequency: Frequency, lastRunAt: Date | null, now: Date = new Date()): boolean {
  if (frequency === "manual") return false;
  if (!lastRunAt) return true;
  return now.getTime() - lastRunAt.getTime() >= PERIOD[frequency];
}
