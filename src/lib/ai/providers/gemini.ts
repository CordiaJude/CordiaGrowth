import { aiConfig } from "../../../config/ai";
import { costFor } from "../pricing";
import { postJson } from "./http";
import type { AskContext, ProviderAnswer, VisibilityProvider } from "./types";

// generateContent response subset (ai.google.dev/gemini-api/docs).
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
};

export function extractGeminiAnswer(res: GeminiResponse) {
  const candidate = res.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  const blocked =
    Boolean(res.promptFeedback?.blockReason) ||
    ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(
      candidate?.finishReason ?? "",
    );
  return { text, refused: blocked && !text };
}

/**
 * Gemini answers WITHOUT Google Search grounding. The Gemini API terms forbid
 * storing, analyzing or link-tracking Grounded Results, so this measures what
 * Gemini says from its own knowledge. Location is added to the prompt context
 * because there is no location parameter without grounding.
 */
export function geminiProvider(fetchImpl?: typeof fetch): VisibilityProvider {
  return {
    id: "gemini",
    label: "Gemini",
    get model() {
      return aiConfig().providers.gemini.model;
    },
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
    async ask(prompt: string, ctx: AskContext): Promise<ProviderAnswer> {
      const cfg = aiConfig().providers.gemini;
      const loc = [ctx.location?.city, ctx.location?.region, ctx.location?.country]
        .filter(Boolean)
        .join(", ");
      const res = await postJson<GeminiResponse>(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
        {
          ...(loc ? { systemInstruction: { parts: [{ text: `The user is located in ${loc}.` }] } } : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        },
        { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        { provider: "Gemini", fetchImpl },
      );
      const { text, refused } = extractGeminiAnswer(res);
      const usage = {
        inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
        // Thinking tokens are billed as output.
        outputTokens:
          (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        searchRequests: 0,
      };
      const model = cfg.model;
      return {
        status: refused ? "refused" : "ok",
        text,
        citedUrls: [],
        model,
        usage,
        costUsd: costFor(model, usage),
      };
    },
  };
}
