import { aiConfig } from "../../../config/ai";
import { costFor } from "../pricing";
import { postJson } from "./http";
import type { AskContext, ProviderAnswer, VisibilityProvider } from "./types";

// Subset of the Responses API shape we read (developers.openai.com, web search guide).
type OpenAIResponse = {
  model: string;
  status?: string;
  output: Array<
    | { type: "web_search_call"; action?: { type?: string } }
    | {
        type: "message";
        content: Array<
          | { type: "output_text"; text: string; annotations?: Array<{ type: string; url?: string }> }
          | { type: "refusal"; refusal: string }
        >;
      }
    | { type: string }
  >;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function extractOpenAIAnswer(res: OpenAIResponse) {
  let text = "";
  let refused = false;
  const urls: string[] = [];
  let searches = 0;
  for (const item of res.output ?? []) {
    if (item.type === "web_search_call") {
      const action = (item as { action?: { type?: string } }).action;
      if (!action?.type || action.type === "search") searches++;
    } else if (item.type === "message") {
      for (const part of (item as Extract<OpenAIResponse["output"][number], { type: "message" }>).content) {
        if (part.type === "output_text") {
          text += part.text;
          for (const a of part.annotations ?? []) if (a.type === "url_citation" && a.url) urls.push(a.url);
        } else if (part.type === "refusal") {
          refused = true;
        }
      }
    }
  }
  return { text: text.trim(), citedUrls: urls, searches, refused };
}

export function openaiProvider(fetchImpl?: typeof fetch): VisibilityProvider {
  return {
    id: "openai",
    label: "ChatGPT",
    get model() {
      return aiConfig().providers.openai.model;
    },
    isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
    async ask(prompt: string, ctx: AskContext): Promise<ProviderAnswer> {
      const cfg = aiConfig().providers.openai;
      const loc = ctx.location;
      const user_location =
        loc && (loc.city || loc.region || loc.country)
          ? {
              type: "approximate",
              ...(loc.city ? { city: loc.city } : {}),
              ...(loc.region ? { region: loc.region } : {}),
              ...(loc.country && /^[A-Z]{2}$/.test(loc.country) ? { country: loc.country } : {}),
            }
          : undefined;
      const res = await postJson<OpenAIResponse>(
        "https://api.openai.com/v1/responses",
        {
          model: cfg.model,
          input: prompt,
          tools: [
            {
              type: "web_search",
              search_context_size: cfg.searchContextSize,
              ...(user_location ? { user_location } : {}),
            },
          ],
          // Always search, so runs are comparable across providers.
          tool_choice: "required",
          store: false,
        },
        { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        { provider: "OpenAI", fetchImpl },
      );
      const { text, citedUrls, searches, refused } = extractOpenAIAnswer(res);
      const usage = {
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
        searchRequests: searches,
      };
      const model = res.model || cfg.model;
      return {
        status: refused ? "refused" : "ok",
        text,
        citedUrls,
        model,
        usage,
        costUsd: costFor(model, usage),
      };
    },
  };
}
