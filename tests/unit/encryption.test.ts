import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decrypt,
  decryptJson,
  encrypt,
  encryptJson,
  needsRotation,
  parseKeyRing,
} from "@/lib/crypto/encryption";

const k = () => randomBytes(32).toString("base64");

describe("parseKeyRing", () => {
  it("uses the highest version as current", () => {
    const ring = parseKeyRing(`1:${k()}, 3:${k()},2:${k()}`);
    expect(ring.current).toBe(3);
    expect(ring.keys.size).toBe(3);
  });

  it.each([
    ["", /No encryption keys/],
    ["abc", /version/],
    [`0:${k()}`, /Invalid encryption key version/],
    [`1:${randomBytes(16).toString("base64")}`, /32 bytes/],
    [`1:${k()},1:${k()}`, /Duplicate/],
  ])("rejects %j", (spec, err) => {
    expect(() => parseKeyRing(spec)).toThrow(err);
  });
});

describe("encrypt/decrypt", () => {
  const ring = parseKeyRing(`1:${k()}`);

  it("round-trips text and JSON", () => {
    const enc = encrypt("app-password 1234", "ctx", ring);
    expect(enc.ciphertext).toMatch(/^v1\./);
    expect(enc.ciphertext).not.toContain("app-password");
    expect(decrypt(enc.ciphertext, "ctx", ring)).toBe("app-password 1234");

    const json = encryptJson({ token: "t", scopes: ["a"] }, "ctx", ring);
    expect(decryptJson(json.ciphertext, "ctx", ring)).toEqual({ token: "t", scopes: ["a"] });
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same", "ctx", ring).ciphertext).not.toBe(encrypt("same", "ctx", ring).ciphertext);
  });

  it("fails with the wrong context (ciphertext moved to another row)", () => {
    const enc = encrypt("secret", "integration:site-a:wordpress", ring);
    expect(() => decrypt(enc.ciphertext, "integration:site-b:wordpress", ring)).toThrow();
  });

  it("fails when the ciphertext is tampered with", () => {
    const enc = encrypt("secret", "ctx", ring);
    const parts = enc.ciphertext.split(".");
    const data = Buffer.from(parts[3], "base64url");
    data[0] ^= 1;
    parts[3] = data.toString("base64url");
    expect(() => decrypt(parts.join("."), "ctx", ring)).toThrow();
  });

  it("rejects malformed input and unknown key versions", () => {
    expect(() => decrypt("nope", "ctx", ring)).toThrow(/Malformed/);
    const other = parseKeyRing(`7:${k()}`);
    const enc = encrypt("x", "ctx", other);
    expect(() => decrypt(enc.ciphertext, "ctx", ring)).toThrow(/v7 is not configured/);
  });

  it("supports rotation: old ciphertext still decrypts, new writes use the new key", () => {
    const v1 = k();
    const oldRing = parseKeyRing(`1:${v1}`);
    const enc = encrypt("secret", "ctx", oldRing);
    const rotated = parseKeyRing(`1:${v1},2:${k()}`);
    expect(decrypt(enc.ciphertext, "ctx", rotated)).toBe("secret");
    expect(needsRotation(enc, rotated)).toBe(true);
    expect(encrypt("secret", "ctx", rotated).keyVersion).toBe(2);
  });
});
