import { describe, expect, it } from "vitest";
import { normalizeDomain } from "@/lib/domain";

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["  Example.COM  ", "example.com"],
    ["https://www.example.com/about?x=1", "example.com"],
    ["http://shop.example.co.uk:8080/", "shop.example.co.uk"],
    ["www.example.com.", "example.com"],
    ["münchen.de", "xn--mnchen-3ya.de"],
    ["example.xn--p1ai", "example.xn--p1ai"],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeDomain(input)).toEqual({ ok: true, domain: expected });
  });

  it.each([
    "",
    "localhost",
    "127.0.0.1",
    "http://10.0.0.5/",
    "[::1]",
    "intranet",
    "printer.local",
    "metadata.google.internal",
    "ftp://example.com",
    "https://user:pass@example.com",
    "exa mple.com",
    "-bad.com",
    "example.c",
  ])("rejects %j", (input) => {
    expect(normalizeDomain(input).ok).toBe(false);
  });
});
