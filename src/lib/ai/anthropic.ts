import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

/** Shared Anthropic client (reads ANTHROPIC_API_KEY). */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 3, timeout: 5 * 60 * 1000 });
  return client;
}

/** Server-side refusal fallbacks: on a policy decline the API retries on Anthropic's recommended model. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Request params that opt into server-side refusal fallbacks, for models that
 * support them. Haiku has no server-side fallback, so nothing is sent for it
 * (refusals are handled by the caller).
 */
export function fallbackParams(model: string): { betas?: string[]; fallbacks?: "default" } {
  return model.startsWith("claude-haiku") ? {} : { betas: [FALLBACK_BETA], fallbacks: "default" };
}
