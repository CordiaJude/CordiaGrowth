import { describe, expect, it } from "vitest";
import { costFor, priceFor } from "@/lib/ai/pricing";
import { isDue } from "@/lib/visibility/schedule";
import { mapPool } from "@/lib/visibility/pool";

const table = {
  "model-a": { inputPerM: 2, outputPerM: 10, perSearch: 0.01 },
  "model-a-long": { inputPerM: 3, outputPerM: 12 },
  flat: { inputPerM: 0, outputPerM: 0, perRequest: 0.005 },
};

describe("pricing", () => {
  it("prices tokens, searches and request fees", () => {
    expect(
      costFor("model-a", { inputTokens: 1_000_000, outputTokens: 100_000, searchRequests: 2 }, table),
    ).toBeCloseTo(3.02, 6);
    expect(costFor("flat", { inputTokens: 5, outputTokens: 5, searchRequests: 0 }, table)).toBe(0.005);
  });
  it("uses the longest matching prefix for dated model IDs", () => {
    expect(priceFor("model-a-long-2026-10-01", table)).toEqual(table["model-a-long"]);
    expect(priceFor("model-a-2026", table)).toEqual(table["model-a"]);
  });
  it("returns 0 for unknown models", () => {
    expect(costFor("mystery", { inputTokens: 1e6, outputTokens: 1e6, searchRequests: 1 }, table)).toBe(0);
  });
  it("has prices for every configured default model", async () => {
    const { aiConfig } = await import("@/config/ai");
    const cfg = aiConfig();
    for (const p of Object.values(cfg.providers)) expect(priceFor(p.model), p.model).not.toBeNull();
    expect(priceFor(cfg.parser.model)).not.toBeNull();
  });
});

describe("isDue", () => {
  const now = new Date("2026-10-26T06:17:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
  it("never schedules manual sites", () => expect(isDue("manual", null, now)).toBe(false));
  it("runs when there's no previous run", () => expect(isDue("weekly", null, now)).toBe(true));
  it("daily cron keeps a daily cadence", () => {
    expect(isDue("daily", ago(24), now)).toBe(true);
    expect(isDue("daily", ago(12), now)).toBe(false);
  });
  it("weekly and monthly", () => {
    expect(isDue("weekly", ago(6 * 24), now)).toBe(false);
    expect(isDue("weekly", ago(7 * 24), now)).toBe(true);
    expect(isDue("monthly", ago(27 * 24), now)).toBe(false);
    expect(isDue("monthly", ago(28 * 24), now)).toBe(true);
  });
});

describe("mapPool", () => {
  it("limits concurrency and preserves order", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
  it("stops picking up work when told to", async () => {
    let done = 0;
    await mapPool(
      [1, 2, 3, 4, 5],
      1,
      async () => void done++,
      () => done >= 2,
    );
    expect(done).toBe(2);
  });
});
