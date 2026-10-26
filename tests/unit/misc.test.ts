import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { safeNextPath } from "@/lib/redirect";
import { extractTitle } from "@/jobs/site-healthcheck";

describe("slugify", () => {
  it.each([
    ["Acme Plumbing & Co.", "acme-plumbing-co"],
    ["  Café Déjà Vu ", "cafe-deja-vu"],
    ["---", ""],
    ["a".repeat(60), "a".repeat(48)],
  ])("%j -> %j", (input, out) => expect(slugify(input)).toBe(out));
});

describe("safeNextPath", () => {
  it.each([
    ["/o/acme", "/o/acme"],
    ["/o/acme/s/1?tab=x", "/o/acme/s/1?tab=x"],
    ["https://evil.com", "/app"],
    ["//evil.com", "/app"],
    ["/\\evil.com", "/app"],
    ["/ok\nSet-Cookie: x", "/app"],
    [null, "/app"],
  ])("%j -> %j", (input, out) => expect(safeNextPath(input)).toBe(out));
});

describe("extractTitle", () => {
  it("extracts and decodes the title", () => {
    expect(extractTitle("<html><head><title>\n  Tom &amp; Jerry&#39;s  </title></head>")).toBe(
      "Tom & Jerry's",
    );
  });
  it("returns null when missing or empty", () => {
    expect(extractTitle("<html></html>")).toBeNull();
    expect(extractTitle("<title> </title>")).toBeNull();
  });
});
