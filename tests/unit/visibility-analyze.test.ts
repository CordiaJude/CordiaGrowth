import { describe, expect, it } from "vitest";
import { brandNames, mentionsAny } from "@/lib/visibility/brand-match";
import { analyzeAnswer, type ParsedAnswer } from "@/lib/visibility/parse";

const brand = { name: "Acme Plumbing", aliases: ["Acme"], domains: ["acmeplumbing.com"] };
const competitors = [
  { name: "Bolt Plumbing", aliases: ["Bolt"], domain: "boltplumbing.com" },
  { name: "Drip Doctors", aliases: [], domain: null },
];

describe("mentionsAny", () => {
  it("matches whole words, case-insensitively", () => {
    expect(mentionsAny("Try ACME plumbing first.", ["Acme Plumbing"])).toBe(true);
    expect(mentionsAny("Acmeville Plumbers are fine", ["Acme"])).toBe(false);
    expect(mentionsAny("Visit acmeplumbing.com today", ["acmeplumbing.com"])).toBe(true);
  });
  it("normalizes curly apostrophes and dashes", () => {
    expect(mentionsAny("Joe’s Pipes – great", ["Joe's Pipes"])).toBe(true);
  });
  it("ignores names shorter than 2 chars", () => {
    expect(mentionsAny("a b c", ["a"])).toBe(false);
  });
  it("brandNames includes aliases and domains", () => {
    expect(brandNames(brand)).toEqual(["Acme Plumbing", "Acme", "acmeplumbing.com"]);
  });
});

describe("analyzeAnswer", () => {
  const answer = `Here are the top plumbers in Austin:
1. Bolt Plumbing – fast and reliable.
2. Acme Plumbing – great reviews.
3. Pipe Pros – affordable.
Unlike Drip Doctors, these offer 24/7 service.`;

  const parsed: ParsedAnswer = {
    is_list: true,
    businesses: [
      { name: "Bolt Plumbing", position: 1, is_our_brand: false, competitor: "Bolt Plumbing" },
      { name: "Imaginary Co", position: 2, is_our_brand: false, competitor: null },
      { name: "Acme Plumbing", position: 3, is_our_brand: true, competitor: null },
      { name: "Pipe Pros", position: 4, is_our_brand: false, competitor: "Not A Listed Competitor" },
      { name: "Drip Doctors", position: null, is_our_brand: false, competitor: "drip doctors" },
    ],
  };

  it("drops hallucinated names, renumbers positions, validates competitor labels", () => {
    const a = analyzeAnswer({
      answer,
      parsed,
      brand,
      competitors,
      citedDomains: ["yelp.com", "www2.acmeplumbing.com"],
    });
    expect(a.entities.map((e) => e.name)).toEqual([
      "Bolt Plumbing",
      "Acme Plumbing",
      "Pipe Pros",
      "Drip Doctors",
    ]);
    expect(a.brandMentioned).toBe(true);
    expect(a.brandPosition).toBe(2);
    expect(a.listedCount).toBe(3);
    expect(a.entities.find((e) => e.name === "Pipe Pros")?.kind).toBe("other");
    expect(a.competitorsMentioned).toEqual(["Bolt Plumbing", "Drip Doctors"]);
    expect(a.ourDomainCited).toBe(true);
  });

  it("falls back to literal matching when parsing failed", () => {
    const a = analyzeAnswer({ answer, parsed: null, brand, competitors, citedDomains: [] });
    expect(a.brandMentioned).toBe(true);
    expect(a.brandPosition).toBeNull();
    expect(a.competitorsMentioned).toEqual(["Bolt Plumbing", "Drip Doctors"]);
    expect(a.ourDomainCited).toBe(false);
  });

  it("does not trust a parser claim of our brand that isn't in the text", () => {
    const a = analyzeAnswer({
      answer: "Try Bolt Plumbing or Pipe Pros.",
      parsed: {
        is_list: false,
        businesses: [{ name: "Pipe Pros", position: 1, is_our_brand: true, competitor: null }],
      },
      brand,
      competitors,
      citedDomains: [],
    });
    expect(a.brandMentioned).toBe(false);
    expect(a.entities[0].kind).toBe("other");
  });

  it("reports no mention when nothing matches", () => {
    const a = analyzeAnswer({
      answer: "I can't recommend specific businesses.",
      parsed: { is_list: false, businesses: [] },
      brand,
      competitors,
      citedDomains: [],
    });
    expect(a).toMatchObject({
      brandMentioned: false,
      brandPosition: null,
      listedCount: 0,
      competitorsMentioned: [],
    });
  });
});
