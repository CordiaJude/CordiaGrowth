import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiConfig } from "../config/ai";
import { anthropic, FALLBACK_BETA } from "../lib/ai/anthropic";
import { costFor } from "../lib/ai/pricing";
import { summarizeHtml, type PageSummary } from "../lib/html/extract";
import { safeFetch } from "../lib/net/safe-fetch";
import { createAdminClient } from "../lib/supabase/admin";
import type { JobHandler } from "./runtime";

export const VISIBILITY_SUGGEST = "visibility-suggest-prompts";

const SuggestionsSchema = z.object({
  prompts: z
    .array(
      z.object({
        text: z.string().describe("The question exactly as a person would type it into an AI assistant."),
        rationale: z.string().describe("One short sentence: why this prompt matters for this business."),
      }),
    )
    .describe("Distinct prompts, most valuable first."),
});

const SYSTEM = `You help a business track whether AI assistants (ChatGPT, Claude, Gemini, Perplexity) recommend it.
Write prompts that real potential customers would ask an AI assistant when looking for what this business offers.

Guidelines:
- Mostly unbranded discovery questions ("best ...", "who should I hire for ...", "... near me alternatives", comparisons, problem-driven questions). At most 2 prompts may name the business itself.
- If the business serves a local area, include the city or region naturally in most prompts.
- Vary intent: recommendations, comparisons, costs/pricing questions, how-to-choose questions, specific services.
- Use plain, natural phrasing; no keyword stuffing; each under 150 characters.
- Base everything on the business information given. Do not invent services the business doesn't appear to offer.`;

/** Builds the user message describing the business (exported for tests). */
export function describeBusiness(
  site: {
    name: string;
    domain: string;
    business_type: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  },
  page: PageSummary | null,
  count: number,
): string {
  const location = [site.city, site.region, site.country].filter(Boolean).join(", ");
  return [
    `Business name: ${site.name}`,
    `Website: ${site.domain}`,
    `Business type: ${site.business_type || "(not given)"}`,
    `Location: ${location || "(not given; may be online/national)"}`,
    page
      ? [
          `Homepage title: ${page.title ?? ""}`,
          `Meta description: ${page.metaDescription ?? ""}`,
          `Headings: ${page.headings.join(" | ")}`,
          `Homepage text (excerpt): ${page.text}`,
        ].join("\n")
      : "Homepage: could not be fetched.",
    "",
    `Write ${count} prompts.`,
  ].join("\n");
}

/**
 * Suggests starter prompts from the site's homepage and business info.
 * Suggestions are stored with status "suggested"; nothing is tracked until a
 * user accepts them.
 */
export const visibilitySuggestPrompts: JobHandler = async ({ jobRunId, siteId, payload, log }) => {
  if (!siteId) throw new Error("Suggesting prompts requires a site");
  const count = Math.min(Math.max(Number((payload as { count?: number })?.count ?? 20), 5), 30);
  const db = createAdminClient();
  const { data: site } = await db
    .from("sites")
    .select("id, org_id, name, domain, business_type, city, region, country")
    .eq("id", siteId)
    .single();
  if (!site) throw new Error("Site not found");

  const { data: settings } = await db
    .from("site_settings")
    .select("monthly_ai_budget_usd")
    .eq("site_id", siteId)
    .single();
  const { data: spent } = await db.rpc("site_ai_spend_this_month", { p_site_id: siteId });
  if (settings && Number(spent ?? 0) >= Number(settings.monthly_ai_budget_usd)) {
    throw new Error("This site's monthly AI budget is used up.");
  }

  let page: PageSummary | null = null;
  try {
    await log(`Reading https://${site.domain}/`);
    const res = await safeFetch(`https://${site.domain}/`, { maxBytes: 2 * 1024 * 1024 });
    if (res.status < 400) page = summarizeHtml(res.body);
    else await log(`Homepage returned HTTP ${res.status}; using business info only`, "warn");
  } catch (e) {
    await log(
      `Couldn't fetch homepage (${e instanceof Error ? e.message : e}); using business info only`,
      "warn",
    );
  }

  const cfg = aiConfig().suggester;
  await log(`Asking ${cfg.model} for ${count} prompts`);
  const response = await anthropic().beta.messages.parse({
    model: cfg.model,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: cfg.effort, format: betaZodOutputFormat(SuggestionsSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: describeBusiness(site, page, count) }],
  });

  const usage = {
    inputTokens:
      response.usage.input_tokens +
      (response.usage.cache_read_input_tokens ?? 0) +
      (response.usage.cache_creation_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
    searchRequests: 0,
  };
  const cost = costFor(response.model, usage);
  await db.from("llm_usage").insert({
    org_id: site.org_id,
    site_id: siteId,
    job_run_id: jobRunId,
    provider: "anthropic",
    model: response.model,
    purpose: "prompt_suggestions",
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: cost,
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("The model didn't return suggestions. Try again or add prompts manually.");
  }

  const { data: existing } = await db.from("visibility_prompts").select("text").eq("site_id", siteId);
  const seen = new Set((existing ?? []).map((p) => p.text.trim().toLowerCase()));
  const rows = [];
  for (const p of response.parsed_output.prompts) {
    const text = p.text.trim().replace(/\s+/g, " ");
    const key = text.toLowerCase();
    if (text.length < 3 || text.length > 500 || seen.has(key)) continue;
    seen.add(key);
    rows.push({
      org_id: site.org_id,
      site_id: siteId,
      text,
      rationale: p.rationale.slice(0, 500),
      status: "suggested" as const,
      source: "suggested" as const,
    });
  }
  if (rows.length) {
    const { error } = await db.from("visibility_prompts").insert(rows);
    if (error) throw new Error(error.message);
  }
  await log(`Added ${rows.length} suggestions for review`);
  return { suggested: rows.length, cost_usd: cost, homepage_read: page != null };
};
