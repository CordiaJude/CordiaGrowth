import type { Usage } from "../pricing";

export type ProviderId = "anthropic" | "openai" | "gemini" | "perplexity";

export type AskContext = {
  /** Approximate user location, so local queries are answered for the right place. */
  location?: { city?: string | null; region?: string | null; country?: string | null };
};

export type ProviderAnswer = {
  status: "ok" | "refused";
  text: string;
  /** URLs the answer cited, from the provider's citation metadata. */
  citedUrls: string[];
  /** Model that actually served the answer. */
  model: string;
  usage: Usage;
  costUsd: number;
};

export interface VisibilityProvider {
  id: ProviderId;
  label: string;
  model: string;
  isConfigured(): boolean;
  ask(prompt: string, ctx: AskContext): Promise<ProviderAnswer>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
  }
}
