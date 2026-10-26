import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractClaudeAnswer } from "@/lib/ai/providers/anthropic";
import { extractGeminiAnswer, geminiProvider } from "@/lib/ai/providers/gemini";
import { extractOpenAIAnswer, openaiProvider } from "@/lib/ai/providers/openai";
import { extractPerplexityAnswer, perplexityProvider } from "@/lib/ai/providers/perplexity";
import { ProviderError } from "@/lib/ai/providers/types";

// Fixtures follow the response shapes in each provider's docs (checked 2026-10-26).

const openaiFixture = {
  model: "gpt-6.1-sol-2026-09-01",
  output: [
    {
      type: "web_search_call",
      id: "ws_1",
      status: "completed",
      action: { type: "search", queries: ["best plumber austin"] },
    },
    {
      type: "web_search_call",
      id: "ws_2",
      status: "completed",
      action: { type: "open_page", url: "https://yelp.com" },
    },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Top picks: Acme Plumbing and Bolt Plumbing.",
          annotations: [
            {
              type: "url_citation",
              url: "https://www.yelp.com/search?utm_source=openai",
              title: "Yelp",
              start_index: 0,
              end_index: 5,
            },
            {
              type: "url_citation",
              url: "https://acmeplumbing.com/",
              title: "Acme",
              start_index: 6,
              end_index: 9,
            },
          ],
        },
      ],
    },
  ],
  usage: { input_tokens: 1200, output_tokens: 300 },
};

const geminiFixture = {
  candidates: [
    {
      content: {
        parts: [{ text: "thinking...", thought: true }, { text: "Acme Plumbing is well regarded." }],
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 80, thoughtsTokenCount: 120 },
};

const perplexityFixture = {
  model: "perplexity/sonar",
  output: [
    {
      type: "search_results",
      queries: ["best plumber austin"],
      results: [
        { id: 1, url: "https://www.yelp.com/biz/acme", title: "Yelp", snippet: "", source: "web" },
        { id: 2, url: "https://bbb.org/acme", title: "BBB", snippet: "", source: "web" },
        { id: 3, url: "https://reddit.com/r/austin", title: "Reddit", snippet: "", source: "web" },
      ],
    },
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Acme Plumbing [1] and Bolt [web:3].", annotations: [] }],
    },
  ],
  usage: {
    input_tokens: 900,
    output_tokens: 120,
    tool_calls_details: { search_web: { invocation: 1 } },
    cost: { total_cost: 0.0042 },
  },
};

describe("extractors", () => {
  it("OpenAI: text, url_citation annotations, search count", () => {
    const out = extractOpenAIAnswer(openaiFixture as never);
    expect(out.text).toBe("Top picks: Acme Plumbing and Bolt Plumbing.");
    expect(out.citedUrls).toEqual([
      "https://www.yelp.com/search?utm_source=openai",
      "https://acmeplumbing.com/",
    ]);
    expect(out.searches).toBe(1);
    expect(out.refused).toBe(false);
  });

  it("OpenAI: refusal content", () => {
    const out = extractOpenAIAnswer({
      model: "m",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
    } as never);
    expect(out.refused).toBe(true);
  });

  it("Gemini: skips thought parts; blocked prompts are refusals", () => {
    expect(extractGeminiAnswer(geminiFixture)).toEqual({
      text: "Acme Plumbing is well regarded.",
      refused: false,
    });
    expect(extractGeminiAnswer({ promptFeedback: { blockReason: "SAFETY" } })).toEqual({
      text: "",
      refused: true,
    });
  });

  it("Perplexity: cites only results referenced by markers", () => {
    const out = extractPerplexityAnswer(perplexityFixture);
    expect(out.text).toBe("Acme Plumbing [1] and Bolt [web:3].");
    expect(out.citedUrls).toEqual(["https://www.yelp.com/biz/acme", "https://reddit.com/r/austin"]);
  });

  it("Perplexity: without markers, all search results are the sources", () => {
    const fx = structuredClone(perplexityFixture);
    (fx.output[1] as { content: { text: string }[] }).content[0].text = "Acme Plumbing is good.";
    expect(extractPerplexityAnswer(fx).citedUrls).toHaveLength(3);
  });

  it("Claude: joins text blocks and collects web_search_result_location citations", () => {
    const out = extractClaudeAnswer([
      { type: "text", text: "I'll search. ", citations: null },
      { type: "server_tool_use", id: "srv", name: "web_search", input: { query: "q" } },
      {
        type: "text",
        text: "Acme Plumbing is top rated.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://yelp.com/a",
            title: "Yelp",
            cited_text: "x",
            encrypted_index: "e",
          },
        ],
      },
    ] as never);
    expect(out.text).toBe("I'll search. Acme Plumbing is top rated.");
    expect(out.citedUrls).toEqual(["https://yelp.com/a"]);
  });
});

describe("provider requests", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GEMINI_API_KEY = "g-test";
    process.env.PERPLEXITY_API_KEY = "pplx-test";
  });
  afterEach(() => {
    process.env = { ...env };
  });

  const ctx = { location: { city: "Austin", region: "TX", country: "US" } };
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

  it("OpenAI forces web search with the user's location and computes cost", async () => {
    const f = ok(openaiFixture);
    const ans = await openaiProvider(f as never).ask("best plumber in Austin", ctx);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.tool_choice).toBe("required");
    expect(body.store).toBe(false);
    expect(body.tools[0]).toMatchObject({
      type: "web_search",
      user_location: { type: "approximate", city: "Austin", country: "US" },
    });
    expect(ans.usage).toEqual({ inputTokens: 1200, outputTokens: 300, searchRequests: 1 });
    // gpt-6.1-sol: 1200*$2/M + 300*$10/M + 1 search * $0.01 (dated model ID resolves by prefix)
    expect(ans.costUsd).toBeCloseTo(0.0024 + 0.003 + 0.01, 6);
  });

  it("Gemini sends no grounding tool and counts thinking tokens as output", async () => {
    const f = ok(geminiFixture);
    const ans = await geminiProvider(f as never).ask("best plumber", ctx);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(":generateContent");
    const body = JSON.parse(init.body as string);
    expect(body.tools).toBeUndefined();
    expect(body.systemInstruction.parts[0].text).toContain("Austin, TX, US");
    expect(ans.usage).toEqual({ inputTokens: 50, outputTokens: 200, searchRequests: 0 });
    expect(ans.citedUrls).toEqual([]);
  });

  it("Perplexity uses the Agent API with web_search and prefers its reported cost", async () => {
    const f = ok(perplexityFixture);
    const ans = await perplexityProvider(f as never).ask("best plumber", ctx);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.perplexity.ai/v1/agent");
    const body = JSON.parse(init.body as string);
    expect(body.tools[0]).toMatchObject({
      type: "web_search",
      user_location: { city: "Austin", region: "TX", country: "US" },
    });
    expect(ans.costUsd).toBe(0.0042);
    expect(ans.usage.searchRequests).toBe(1);
  });

  it("classifies errors: rate limits retry, auth and billing don't", async () => {
    const respond = (status: number, body: unknown) =>
      vi.fn(async () => new Response(JSON.stringify(body), { status }));
    const p = (f: unknown) => openaiProvider(f as never).ask("q", {});

    const rate = await p(
      respond(429, { error: { message: "slow down", code: "rate_limit_exceeded" } }),
    ).catch((e) => e);
    expect(rate).toBeInstanceOf(ProviderError);
    expect(rate.retryable).toBe(true);

    const billing = await p(
      respond(429, { error: { message: "You exceeded your quota", code: "insufficient_quota" } }),
    ).catch((e) => e);
    expect(billing.retryable).toBe(false);

    const auth = await p(respond(401, { error: { message: "bad key" } })).catch((e) => e);
    expect(auth.retryable).toBe(false);
    expect(auth.message).toContain("HTTP 401");

    const server = await p(respond(503, { error: { message: "overloaded" } })).catch((e) => e);
    expect(server.retryable).toBe(true);
  });

  it("reports unconfigured providers", () => {
    delete process.env.OPENAI_API_KEY;
    expect(openaiProvider().isConfigured()).toBe(false);
  });
});

describe("fallbackParams", () => {
  it("opts Opus/Sonnet into server-side fallbacks but not Haiku (which has none)", async () => {
    const { fallbackParams, FALLBACK_BETA } = await import("@/lib/ai/anthropic");
    expect(fallbackParams("claude-opus-5-5")).toEqual({ betas: [FALLBACK_BETA], fallbacks: "default" });
    expect(fallbackParams("claude-haiku-5-5")).toEqual({});
  });
});
