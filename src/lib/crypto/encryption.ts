import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope for secrets stored at rest (OAuth tokens, CMS
 * credentials). Keys come from the environment only and are versioned so
 * they can be rotated: encrypt with the newest key, decrypt with any.
 *
 * Ciphertext format: "v<version>.<iv>.<tag>.<data>" (base64url parts).
 * `context` is bound as additional authenticated data, so a ciphertext copied
 * to a different row (e.g. another site's integration) fails to decrypt.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export type KeyRing = { current: number; keys: Map<number, Buffer> };

export function parseKeyRing(spec: string): KeyRing {
  const keys = new Map<number, Buffer>();
  for (const entry of spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const sep = entry.indexOf(":");
    if (sep < 1) throw new Error("Encryption key entries must look like '<version>:<base64key>'");
    const version = Number(entry.slice(0, sep));
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Invalid encryption key version: ${entry.slice(0, sep)}`);
    }
    const key = Buffer.from(entry.slice(sep + 1), "base64");
    if (key.length !== 32) {
      throw new Error(`Encryption key v${version} must be 32 bytes (base64), got ${key.length}`);
    }
    if (keys.has(version)) throw new Error(`Duplicate encryption key version: ${version}`);
    keys.set(version, key);
  }
  if (keys.size === 0) throw new Error("No encryption keys configured");
  return { current: Math.max(...keys.keys()), keys };
}

export type EncryptedValue = { ciphertext: string; keyVersion: number };

export function encrypt(plaintext: string, context: string, ring: KeyRing): EncryptedValue {
  const key = ring.keys.get(ring.current)!;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const parts = [iv, tag, data].map((b) => b.toString("base64url"));
  return { ciphertext: `v${ring.current}.${parts.join(".")}`, keyVersion: ring.current };
}

export function decrypt(ciphertext: string, context: string, ring: KeyRing): string {
  const match = /^v(\d+)\.([\w-]+)\.([\w-]+)\.([\w-]*)$/.exec(ciphertext);
  if (!match) throw new Error("Malformed ciphertext");
  const version = Number(match[1]);
  const key = ring.keys.get(version);
  if (!key) throw new Error(`Encryption key v${version} is not configured`);
  const [iv, tag, data] = [match[2], match[3], match[4]].map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown, context: string, ring: KeyRing): EncryptedValue {
  return encrypt(JSON.stringify(value), context, ring);
}

export function decryptJson<T>(ciphertext: string, context: string, ring: KeyRing): T {
  return JSON.parse(decrypt(ciphertext, context, ring)) as T;
}

/** Re-encrypts with the current key when a value was sealed with an older one. */
export function needsRotation(value: EncryptedValue, ring: KeyRing): boolean {
  return value.keyVersion !== ring.current;
}
