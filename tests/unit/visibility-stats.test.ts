import { describe, expect, it } from "vitest";
import { formatPct, shareOfVoice, summarizeRate, wilsonInterval } from "@/lib/visibility/stats";

describe("wilsonInterval", () => {
  it("matches known values", () => {
    const a = wilsonInterval(5, 10);
    expect(a.low).toBeCloseTo(0.2366, 3);
    expect(a.high).toBeCloseTo(0.7634, 3);
    const b = wilsonInterval(0, 10);
    expect(b.low).toBe(0);
    expect(b.high).toBeCloseTo(0.2775, 3);
    const c = wilsonInterval(10, 10);
    expect(c.high).toBe(1);
    expect(c.low).toBeCloseTo(0.7225, 3);
  });

  it("is wide for tiny samples (a single run is not a fact)", () => {
    const { low, high } = wilsonInterval(1, 3);
    expect(high - low).toBeGreaterThan(0.6);
  });

  it("handles n = 0", () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
    expect(summarizeRate(0, 0)).toEqual({ samples: 0, hits: 0, rate: null, low: null, high: null });
  });
});

describe("shareOfVoice / formatPct", () => {
  it("computes share among tracked brands", () => {
    expect(shareOfVoice(3, 9)).toBe(0.25);
    expect(shareOfVoice(0, 0)).toBeNull();
  });
  it("formats", () => {
    expect(formatPct(0.256)).toBe("26%");
    expect(formatPct(null)).toBe("—");
  });
});
