import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import { perplexityProvider } from "./perplexity";
import type { ProviderId, VisibilityProvider } from "./types";

const registry: Record<ProviderId, VisibilityProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider(),
  gemini: geminiProvider(),
  perplexity: perplexityProvider(),
};

export function getProvider(id: string): VisibilityProvider | null {
  return Object.hasOwn(registry, id) ? registry[id as ProviderId] : null;
}

export function allProviders(): VisibilityProvider[] {
  return Object.values(registry);
}
