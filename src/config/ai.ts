import type { ModelPrice } from "../lib/ai/pricing";
import type { ProviderId } from "../lib/ai/providers/types";

/**
 * All AI model IDs, tool versions and prices live here. Model IDs can be
 * overridden per environment without a code change. Prices are list prices
 * (USD) checked against each provider's pricing page on 2026-10-26; update
 * them when providers change pricing.
 */

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;

export function aiConfig() {
  return {
    providers: {
      anthropic: {
        label: "Claude",
        model: env("VISIBILITY_MODEL_ANTHROPIC", "claude-opus-5-5"),
        // Latest web search tool version (docs: platform.claude.com, web search tool).
        webSearchTool: env("ANTHROPIC_WEB_SEARCH_TOOL", "web_search_20260318"),
        maxSearches: 5,
        maxOutputTokens: 8000,
      },
      openai: {
        label: "ChatGPT",
        model: env("VISIBILITY_MODEL_OPENAI", "gpt-6.1-sol"),
        searchContextSize: "medium" as "low" | "medium" | "high",
      },
      gemini: {
        label: "Gemini",
        model: env("VISIBILITY_MODEL_GEMINI", "gemini-3.8-flash"),
        // Grounding with Google Search stays OFF: the Gemini API terms prohibit
        // storing, analyzing or link-tracking Grounded Results, which is exactly
        // what a visibility tracker does. Gemini answers from model knowledge.
        grounding: false,
      },
      perplexity: {
        label: "Perplexity",
        // Agent API (Sonar chat completions was deprecated 2026-09-27).
        model: env("VISIBILITY_MODEL_PERPLEXITY", "perplexity/sonar"),
        maxResults: 10,
      },
    } satisfies Record<ProviderId, { label: string; model: string; [k: string]: unknown }>,

    /** Claude model that extracts brands/positions from answers. */
    parser: {
      model: env("VISIBILITY_PARSER_MODEL", "claude-opus-5-5"),
      effort: env("VISIBILITY_PARSER_EFFORT", "low") as Effort,
    },

    /** Claude model that suggests starter prompts. */
    suggester: {
      model: env("PROMPT_SUGGESTER_MODEL", "claude-opus-5-5"),
      effort: env("PROMPT_SUGGESTER_EFFORT", "medium") as Effort,
    },

    /** Parallel provider calls within one run. */
    concurrency: Number(env("VISIBILITY_CONCURRENCY", "4")),

    /**
     * Rough per-answer cost (answer + parse) used to check a run against the
     * budget before it starts. Actual cost is metered per call in llm_usage.
     */
    estimates: {
      perAnswerUsd: { anthropic: 0.12, openai: 0.07, gemini: 0.03, perplexity: 0.03 } satisfies Record<
        ProviderId,
        number
      >,
    },

    pricing: {
      // Anthropic: platform.claude.com pricing; web search $10 per 1,000.
      "claude-opus-5-5": { inputPerM: 4, outputPerM: 20, perSearch: 0.01 },
      "claude-opus-5": { inputPerM: 5, outputPerM: 25, perSearch: 0.01 },
      "claude-opus-4-8": { inputPerM: 5, outputPerM: 25, perSearch: 0.01 },
      "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10, perSearch: 0.01 },
      "claude-haiku-5-5": { inputPerM: 0.1, outputPerM: 0.5, perSearch: 0.01 },
      // OpenAI: developers.openai.com pricing (standard tier); web search $10 per 1,000 calls.
      "gpt-6-astra": { inputPerM: 10, outputPerM: 50, perSearch: 0.01 },
      "gpt-6.1-sol": { inputPerM: 2, outputPerM: 10, perSearch: 0.01 },
      "gpt-6-luna": { inputPerM: 0.1, outputPerM: 0.5, perSearch: 0.01 },
      // Gemini: ai.google.dev pricing (paid tier; 3.8 Flash promo price through 2026-12-31).
      "gemini-4-argon": { inputPerM: 2, outputPerM: 10 },
      "gemini-3.8-flash": { inputPerM: 0.75, outputPerM: 3.75 },
      "gemini-3.5-flash-lite": { inputPerM: 0.3, outputPerM: 2.5 },
      // Perplexity Agent API: model tokens + web_search $2.50 per 1,000 calls.
      "perplexity/sonar": { inputPerM: 0.25, outputPerM: 2.5, perSearch: 0.0025 },
      "openai/gpt-6-luna": { inputPerM: 0.1, outputPerM: 0.5, perSearch: 0.0025 },
    } satisfies Record<string, ModelPrice>,
  };
}

export type AiConfig = ReturnType<typeof aiConfig>;
