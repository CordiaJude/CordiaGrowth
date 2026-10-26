import type Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "../../../config/ai";
import { anthropic, fallbackParams } from "../anthropic";
import { costFor } from "../pricing";
import type { AskContext, ProviderAnswer, VisibilityProvider } from "./types";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

/** Collects answer text and cited URLs from a (possibly multi-part) Claude response. */
export function extractClaudeAnswer(content: BetaMessage["content"]): { text: string; citedUrls: string[] } {
  let text = "";
  const urls: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      text += block.text;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location") urls.push(c.url);
      }
    }
  }
  return { text: text.trim(), citedUrls: urls };
}

function userLocation(ctx: AskContext) {
  const loc = ctx.location;
  if (!loc || !(loc.city || loc.region || loc.country)) return undefined;
  return {
    type: "approximate" as const,
    city: loc.city ?? undefined,
    region: loc.region ?? undefined,
    country: loc.country && /^[A-Z]{2}$/.test(loc.country) ? loc.country : undefined,
  };
}

export const anthropicProvider: VisibilityProvider = {
  id: "anthropic",
  label: "Claude",
  get model() {
    return aiConfig().providers.anthropic.model;
  },
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async ask(prompt: string, ctx: AskContext): Promise<ProviderAnswer> {
    const cfg = aiConfig().providers.anthropic;
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: prompt }];
    const tools = [
      {
        type: cfg.webSearchTool,
        name: "web_search" as const,
        max_uses: cfg.maxSearches,
        user_location: userLocation(ctx),
      },
    ] as Anthropic.Beta.Messages.BetaToolUnion[];

    const parts: BetaMessage["content"] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let searches = 0;
    let servedBy = cfg.model;
    let refused = false;

    // A long search turn can pause (stop_reason "pause_turn"); send it back to continue.
    for (let turn = 0; turn < 4; turn++) {
      const res = await anthropic().beta.messages.create({
        model: cfg.model,
        max_tokens: cfg.maxOutputTokens,
        ...fallbackParams(cfg.model),
        tools,
        messages,
      });
      servedBy = res.model;
      inputTokens +=
        res.usage.input_tokens +
        (res.usage.cache_read_input_tokens ?? 0) +
        (res.usage.cache_creation_input_tokens ?? 0);
      outputTokens += res.usage.output_tokens;
      searches += res.usage.server_tool_use?.web_search_requests ?? 0;
      parts.push(...res.content);
      if (res.stop_reason === "refusal") {
        refused = true;
        break;
      }
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content });
    }

    const { text, citedUrls } = extractClaudeAnswer(parts);
    const usage = { inputTokens, outputTokens, searchRequests: searches };
    return {
      status: refused ? "refused" : "ok",
      text,
      citedUrls,
      model: servedBy,
      usage,
      costUsd: costFor(servedBy, usage),
    };
  },
};
