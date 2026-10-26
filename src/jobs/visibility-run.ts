import { createAdminClient } from "../lib/supabase/admin";
import type { Json } from "../lib/supabase/database.types";
import { aiConfig } from "../config/ai";
import { getProvider } from "../lib/ai/providers";
import type { ProviderAnswer, VisibilityProvider } from "../lib/ai/providers/types";
import { ProviderError } from "../lib/ai/providers/types";
import { collectCitations, extractUrlsFromText } from "../lib/visibility/citations";
import { analyzeAnswer, parseAnswerWithClaude, type Brand, type Competitor } from "../lib/visibility/parse";
import { mapPool } from "../lib/visibility/pool";
import type { JobHandler } from "./runtime";

export const VISIBILITY_RUN = "visibility-run";

type Call = { promptId: string; promptText: string; provider: VisibilityProvider; sample: number };

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Asks every active prompt N times on every enabled provider (with web
 * search), parses each answer with Claude, and stores results + usage.
 * Stops early when the site's monthly AI budget is reached.
 */
export const visibilityRun: JobHandler = async ({ jobRunId, siteId, payload, log }) => {
  const runId = (payload as { visibilityRunId?: string })?.visibilityRunId;
  if (!siteId || !runId) throw new Error("visibility-run requires a site and visibilityRunId");
  const db = createAdminClient();

  const [
    { data: run },
    { data: site },
    { data: settings },
    { data: brandRow },
    { data: competitorRows },
    { data: prompts },
  ] = await Promise.all([
    db.from("visibility_runs").select("*").eq("id", runId).eq("site_id", siteId).single(),
    db.from("sites").select("id, org_id, city, region, country").eq("id", siteId).single(),
    db.from("site_settings").select("*").eq("site_id", siteId).single(),
    db.from("brand_profiles").select("*").eq("site_id", siteId).single(),
    db.from("competitors").select("name, aliases, domain").eq("site_id", siteId),
    db
      .from("visibility_prompts")
      .select("id, text")
      .eq("site_id", siteId)
      .eq("status", "active")
      .order("created_at"),
  ]);
  if (!run || !site || !settings || !brandRow)
    throw new Error("Run, site, settings or brand profile not found");

  const finish = async (fields: Record<string, unknown>) => {
    await db
      .from("visibility_runs")
      .update({ finished_at: new Date().toISOString(), ...fields })
      .eq("id", runId);
  };

  await db
    .from("visibility_runs")
    .update({ status: "running", started_at: new Date().toISOString(), job_run_id: jobRunId })
    .eq("id", runId);

  const brand: Brand = {
    name: brandRow.brand_name,
    aliases: brandRow.aliases,
    domains: brandRow.own_domains,
  };
  const competitors: Competitor[] = competitorRows ?? [];
  const requested = run.providers.length ? run.providers : settings.visibility_providers;
  const providers: VisibilityProvider[] = [];
  for (const id of requested) {
    const p = getProvider(id);
    if (!p) await log(`Unknown provider "${id}", skipping`, "warn");
    else if (!p.isConfigured()) await log(`${p.label}: no API key configured, skipping`, "warn");
    else providers.push(p);
  }

  if (!prompts?.length || !providers.length) {
    const reason = !prompts?.length ? "No active prompts" : "No configured providers";
    await finish({ status: "failed", error: reason });
    throw new Error(reason);
  }

  const samples = run.samples_per_prompt;
  const calls: Call[] = [];
  for (const prompt of prompts) {
    for (const provider of providers) {
      for (let s = 0; s < samples; s++)
        calls.push({ promptId: prompt.id, promptText: prompt.text, provider, sample: s });
    }
  }

  // Budget gate: refuse to start if the estimate doesn't fit; stop mid-run if spend hits the cap.
  const budget = Number(settings.monthly_ai_budget_usd);
  const { data: spentRaw } = await db.rpc("site_ai_spend_this_month", { p_site_id: siteId });
  let spent = Number(spentRaw ?? 0);
  const estimate = round4(
    calls.reduce((sum, c) => sum + aiConfig().estimates.perAnswerUsd[c.provider.id], 0),
  );
  await db
    .from("visibility_runs")
    .update({
      prompt_count: prompts.length,
      planned_calls: calls.length,
      estimated_cost_usd: estimate,
      providers: providers.map((p) => p.id),
    })
    .eq("id", runId);
  await log(
    `${prompts.length} prompts × ${providers.length} providers × ${samples} samples = ${calls.length} answers (est. $${estimate.toFixed(2)}; $${spent.toFixed(2)} of $${budget.toFixed(2)} used this month)`,
  );
  if (spent + estimate > budget) {
    const msg = `Estimated cost $${estimate.toFixed(2)} would exceed this month's remaining budget ($${Math.max(0, budget - spent).toFixed(2)}). Raise the budget, pause some prompts, or lower samples per prompt.`;
    await finish({ status: "budget_blocked", error: msg });
    return { status: "budget_blocked", estimate, spent, budget };
  }

  let completed = 0;
  let failed = 0;
  let runCost = 0;
  let stoppedForBudget = false;
  const location = { city: site.city, region: site.region, country: site.country };

  const recordUsage = async (
    provider: string,
    model: string,
    purpose: string,
    u: ProviderAnswer["usage"],
    cost: number,
  ) => {
    spent += cost;
    runCost += cost;
    await db.from("llm_usage").insert({
      org_id: site.org_id,
      site_id: siteId,
      job_run_id: jobRunId,
      visibility_run_id: runId,
      provider,
      model,
      purpose,
      input_tokens: u.inputTokens,
      output_tokens: u.outputTokens,
      search_requests: u.searchRequests,
      cost_usd: cost,
    });
  };

  await mapPool(
    calls,
    aiConfig().concurrency,
    async (call) => {
      if (spent >= budget) {
        stoppedForBudget = true;
        return;
      }
      const started = performance.now();
      const base = {
        org_id: site.org_id,
        site_id: siteId,
        run_id: runId,
        prompt_id: call.promptId,
        provider: call.provider.id,
        sample_index: call.sample,
      };
      try {
        const answer = await withRetry(() => call.provider.ask(call.promptText, { location }));
        await recordUsage(call.provider.id, answer.model, "visibility_answer", answer.usage, answer.costUsd);
        const cited = collectCitations([...answer.citedUrls, ...extractUrlsFromText(answer.text)]);

        if (answer.status === "refused" || !answer.text) {
          await db.from("visibility_results").insert({
            ...base,
            model: answer.model,
            status: answer.status === "refused" ? "refused" : "error",
            error: answer.status === "refused" ? "Provider declined to answer" : "Empty answer",
            latency_ms: Math.round(performance.now() - started),
            cost_usd: answer.costUsd,
          });
          failed++;
          return;
        }

        let parsed = null;
        let parseStatus: "parsed" | "failed" = "failed";
        let parseError: string | null = null;
        let parseCost = 0;
        try {
          const p = await withRetry(() =>
            parseAnswerWithClaude({ prompt: call.promptText, answer: answer.text, brand, competitors }),
          );
          await recordUsage("anthropic", p.model, "visibility_parse", p.usage, p.costUsd);
          parseCost = p.costUsd;
          parsed = p.parsed;
          parseStatus = p.parsed ? "parsed" : "failed";
          if (!p.parsed) parseError = "Parser declined or returned no data";
        } catch (e) {
          parseError = `Parse failed: ${errorMessage(e)}`;
        }

        // Even when parsing fails, the deterministic checks still record mentions and citations.
        const analysis = analyzeAnswer({
          answer: answer.text,
          parsed,
          brand,
          competitors,
          citedDomains: cited.domains,
        });
        await db.from("visibility_results").insert({
          ...base,
          model: answer.model,
          status: "ok",
          answer_text: answer.text,
          cited_urls: cited.urls.slice(0, 100),
          cited_domains: cited.domains.slice(0, 100),
          brand_mentioned: analysis.brandMentioned,
          brand_position: analysis.brandPosition,
          listed_count: analysis.listedCount,
          our_domain_cited: analysis.ourDomainCited,
          competitors_mentioned: analysis.competitorsMentioned,
          entities: analysis.entities as unknown as NonNullable<Json>,
          parse_status: parseStatus,
          error: parseError,
          latency_ms: Math.round(performance.now() - started),
          cost_usd: round4(answer.costUsd + parseCost),
        });
        completed++;
      } catch (e) {
        failed++;
        await db.from("visibility_results").insert({
          ...base,
          model: call.provider.model,
          status: "error",
          error: errorMessage(e).slice(0, 1000),
          latency_ms: Math.round(performance.now() - started),
        });
        await log(`${call.provider.label}: ${errorMessage(e)}`, "warn");
      } finally {
        if ((completed + failed) % 10 === 0) {
          await db
            .from("visibility_runs")
            .update({ completed_calls: completed, failed_calls: failed, cost_usd: round4(runCost) })
            .eq("id", runId);
        }
      }
    },
    () => spent >= budget,
  );

  stoppedForBudget ||= completed + failed < calls.length;
  const status = completed === 0 ? "failed" : stoppedForBudget || failed > 0 ? "partial" : "completed";
  const error = stoppedForBudget
    ? `Stopped after reaching the monthly budget ($${budget.toFixed(2)}).`
    : failed > 0
      ? `${failed} of ${calls.length} answers failed.`
      : null;
  await finish({
    status,
    error,
    completed_calls: completed,
    failed_calls: failed,
    cost_usd: round4(runCost),
  });
  await log(`Done: ${completed} answers stored, ${failed} failed, cost $${runCost.toFixed(4)}`);
  if (completed === 0) throw new Error(error ?? "No answers were stored");

  return { status, completed, failed, planned: calls.length, cost_usd: round4(runCost) };
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Retries retryable provider errors (rate limits, 5xx) with backoff. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e instanceof ProviderError ? e.retryable : false;
      if (!retryable || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i + Math.random() * 500));
    }
  }
}
