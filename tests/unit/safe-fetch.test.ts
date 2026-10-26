import { describe, expect, it } from "vitest";
import { safeFetch, safeLookup, UnsafeTargetError } from "@/lib/net/safe-fetch";

describe("safeLookup", () => {
  it("refuses hostnames that resolve to loopback", async () => {
    const err = await new Promise<Error | null>((resolve) =>
      safeLookup("localhost", { all: true }, (e) => resolve(e)),
    );
    expect(err).toBeInstanceOf(UnsafeTargetError);
  });
});

describe("safeFetch", () => {
  it("rejects non-http protocols", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/Unsupported protocol/);
  });

  it("refuses to connect to loopback addresses", async () => {
    await expect(safeFetch("http://localhost:54321/")).rejects.toThrow();
    await expect(safeFetch("http://127.0.0.1:54321/")).rejects.toThrow();
  });
});

describe("safeFetch IP literals", () => {
  it.each([
    "http://[::1]:54321/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::ffff:127.0.0.1]:54321/",
  ])("refuses %s", async (url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(UnsafeTargetError);
  });
});
