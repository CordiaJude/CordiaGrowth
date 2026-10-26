import { aiConfig } from "../../../config/ai";
import { costFor } from "../pricing";
import { postJson } from "./http";
import type { AskContext, ProviderAnswer, VisibilityProvider } from "./types";

// Agent API response subset (docs.perplexity.ai/docs/agent-api).
type PerplexityResponse = {
  model?: string;
  output?: Array<
    | { type: "search_results"; results?: Array<{ id: number | string; url: string }> }
    | {
        type: "message";
        content?: Array<{
          type: string;
          text?: string;
          annotations?: Array<{ type?: string; url?: string }>;
        }>;
      }
    | { type: string }
  >;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    tool_calls_details?: { search_web?: { invocation?: number } };
    cost?: { total_cost?: number };
  };
};

/**
 * Answer text plus cited URLs. Citations are the search results referenced by
 * inline markers ([1] or [web:1]); if the answer has no markers, all results
 * the answer was generated from are treated as its sources.
 */
export function extractPerplexityAnswer(res: PerplexityResponse) {
  let text = "";
  const annotated: string[] = [];
  const results: { id: string; url: string }[] = [];
  for (const item of res.output ?? []) {
    if (item.type === "search_results") {
      for (const r of (item as { results?: Array<{ id: number | string; url: string }> }).results ?? []) {
        if (r?.url) results.push({ id: String(r.id), url: r.url });
      }
    } else if (item.type === "message") {
      for (const c of (
        item as { content?: Array<{ type: string; text?: string; annotations?: Array<{ url?: string }> }> }
      ).content ?? []) {
        if (c.type === "output_text" && c.text) {
          text += c.text;
          for (const a of c.annotations ?? []) if (a.url) annotated.push(a.url);
        }
      }
    }
  }
  const markerIds = new Set([...text.matchAll(/\[(?:web:)?(\d+)\]/g)].map((m) => m[1]));
  const marked = results.filter((r) => markerIds.has(r.id)).map((r) => r.url);
  const citedUrls = annotated.length ? annotated : marked.length ? marked : results.map((r) => r.url);
  return { text: text.trim(), citedUrls };
}

export function perplexityProvider(fetchImpl?: typeof fetch): VisibilityProvider {
  return {
    id: "perplexity",
    label: "Perplexity",
    get model() {
      return aiConfig().providers.perplexity.model;
    },
    isConfigured: () => Boolean(process.env.PERPLEXITY_API_KEY),
    async ask(prompt: string, ctx: AskContext): Promise<ProviderAnswer> {
      const cfg = aiConfig().providers.perplexity;
      const loc = ctx.location;
      const user_location =
        loc && (loc.city || loc.region || loc.country)
          ? {
              ...(loc.city ? { city: loc.city } : {}),
              ...(loc.region ? { region: loc.region } : {}),
              ...(loc.country && /^[A-Z]{2}$/.test(loc.country) ? { country: loc.country } : {}),
            }
          : undefined;
      const res = await postJson<PerplexityResponse>(
        "https://api.perplexity.ai/v1/agent",
        {
          model: cfg.model,
          input: prompt,
          tools: [
            { type: "web_search", max_results: cfg.maxResults, ...(user_location ? { user_location } : {}) },
          ],
          tool_choice: "required",
        },
        { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
        { provider: "Perplexity", fetchImpl },
      );
      const { text, citedUrls } = extractPerplexityAnswer(res);
      const usage = {
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
        searchRequests: res.usage?.tool_calls_details?.search_web?.invocation ?? 0,
      };
      const model = res.model || cfg.model;
      // Perplexity reports its own cost; prefer it over our estimate.
      const reported = res.usage?.cost?.total_cost;
      const costUsd = typeof reported === "number" && reported >= 0 ? reported : costFor(model, usage);
      return { status: "ok", text, citedUrls, model, usage, costUsd };
    },
  };
}
