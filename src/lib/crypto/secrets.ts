import "server-only";
import { serverEnv } from "@/lib/env";
import { parseKeyRing, type KeyRing } from "./encryption";

let ring: KeyRing | undefined;

export function keyRing(): KeyRing {
  ring ??= parseKeyRing(serverEnv().ENCRYPTION_KEYS);
  return ring;
}

/** AAD context for an integration's credentials. */
export function integrationContext(siteId: string, provider: string): string {
  return `integration:${siteId}:${provider}`;
}
