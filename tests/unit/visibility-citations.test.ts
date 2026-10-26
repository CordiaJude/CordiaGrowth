import { describe, expect, it } from "vitest";
import {
  collectCitations,
  domainMatches,
  domainOf,
  extractUrlsFromText,
  normalizeUrl,
} from "@/lib/visibility/citations";

describe("citations", () => {
  it("domainOf strips www and rejects non-http", () => {
    expect(domainOf("https://www.Yelp.com/biz/x")).toBe("yelp.com");
    expect(domainOf("http://sub.example.co.uk/")).toBe("sub.example.co.uk");
    expect(domainOf("mailto:a@b.com")).toBeNull();
    expect(domainOf("not a url")).toBeNull();
  });

  it("normalizeUrl drops fragments and tracking params", () => {
    expect(normalizeUrl("https://Example.com/a?utm_source=x&id=2#top")).toBe("https://example.com/a?id=2");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("extracts URLs from prose and markdown", () => {
    const text =
      "See [Yelp](https://www.yelp.com/biz/acme). Also https://acme.com/about, and (https://bbb.org/x).";
    expect(extractUrlsFromText(text)).toEqual([
      "https://www.yelp.com/biz/acme",
      "https://acme.com/about",
      "https://bbb.org/x",
    ]);
  });

  it("dedupes URLs and collects domains", () => {
    const out = collectCitations([
      "https://www.yelp.com/biz/acme?utm_medium=ai",
      "https://www.yelp.com/biz/acme",
      "https://acme.com/",
      "ftp://x.com",
    ]);
    expect(out.urls).toEqual(["https://www.yelp.com/biz/acme", "https://acme.com"]);
    expect(out.domains).toEqual(["yelp.com", "acme.com"]);
  });

  it("domainMatches covers subdomains only", () => {
    expect(domainMatches("blog.acme.com", "acme.com")).toBe(true);
    expect(domainMatches("acme.com", "www.acme.com")).toBe(true);
    expect(domainMatches("notacme.com", "acme.com")).toBe(false);
  });
});
