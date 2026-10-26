import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

/** Shared Anthropic client (reads ANTHROPIC_API_KEY). */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 3, timeout: 5 * 60 * 1000 });
  return client;
}

/** Server-side refusal fallbacks: on a policy decline the API retries on Anthropic's recommended model. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
