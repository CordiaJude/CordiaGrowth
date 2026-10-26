import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAnswer, VisibilityProvider } from "@/lib/ai/providers/types";
import { admin, newOrg, newSite, newUser } from "./helpers";

// Fake providers and parser: the job's orchestration, budget logic and storage
// are real; no network calls are made.
const calls: string[] = [];
let answerCost = 0.01;
function fake(id: "openai" | "perplexity", text: string, urls: string[]): VisibilityProvider {
  return {
    id,
    label: id,
    model: `${id}-model`,
    isConfigured: () => true,
    ask: async (prompt): Promise<ProviderAnswer> => {
      calls.push(`${id}:${prompt}`);
      return {
        status: "ok",
        text,
        citedUrls: urls,
        model: `${id}-model`,
        usage: { inputTokens: 10, outputTokens: 5, searchRequests: 1 },
        costUsd: answerCost,
      };
    },
  };
}
const providers: Record<string, VisibilityProvider> = {
  openai: fake("openai", "1. Bolt Plumbing\n2. Acme Plumbing", [
    "https://www.yelp.com/biz/acme",
    "https://acmeplumbing.com/",
  ]),
  perplexity: fake("perplexity", "Try Bolt Plumbing.", ["https://bbb.org/bolt"]),
};

vi.mock("@/lib/ai/providers", () => ({
  getProvider: (id: string) => providers[id] ?? null,
  allProviders: () => Object.values(providers),
}));
vi.mock("@/lib/visibility/parse", async (orig) => {
  const real = await orig<typeof import("@/lib/visibility/parse")>();
  return {
    ...real,
    parseAnswerWithClaude: vi.fn(async ({ answer }: { answer: string }) => ({
      parsed: {
        is_list: true,
        businesses: answer.includes("Acme")
          ? [
              { name: "Bolt Plumbing", position: 1, is_our_brand: false, competitor: "Bolt Plumbing" },
              { name: "Acme Plumbing", position: 2, is_our_brand: true, competitor: null },
            ]
          : [{ name: "Bolt Plumbing", position: 1, is_our_brand: false, competitor: "Bolt Plumbing" }],
      },
      model: "claude-test",
      usage: { inputTokens: 20, outputTokens: 10, searchRequests: 0 },
      costUsd: 0.002,
    })),
  };
});

const { executeJobRun } = await import("@/jobs/runtime");
const { visibilityRun } = await import("@/jobs/visibility-run");

let ctx: { orgId: string; siteId: string; userId: string };

async function startRun(samples = 2) {
  const db = admin();
  const { data: run } = await db
    .from("visibility_runs")
    .insert({
      org_id: ctx.orgId,
      site_id: ctx.siteId,
      providers: ["openai", "perplexity"],
      samples_per_prompt: samples,
    })
    .select("id")
    .single();
  const { data: job } = await db
    .from("job_runs")
    .insert({
      org_id: ctx.orgId,
      site_id: ctx.siteId,
      task_id: "visibility-run",
      runner: "inline",
      payload: { visibilityRunId: run!.id },
    })
    .select("id")
    .single();
  const result = await executeJobRun(job!.id, visibilityRun);
  const { data: after } = await db.from("visibility_runs").select("*").eq("id", run!.id).single();
  return { result, run: after!, runId: run!.id };
}

beforeAll(async () => {
  const u = await newUser("vrun");
  const org = await newOrg(u.client, "Run Org");
  const site = await newSite(u.client, org.id, u.id, "acmeplumbing.com");
  ctx = { orgId: org.id, siteId: site.id, userId: u.id };
  const db = admin();
  await db.from("brand_profiles").update({ brand_name: "Acme Plumbing" }).eq("site_id", site.id);
  await db.from("competitors").insert({ org_id: org.id, site_id: site.id, name: "Bolt Plumbing" });
  await db.from("visibility_prompts").insert([
    // Same keys on every row: PostgREST bulk inserts send null (not the default) for missing keys.
    { org_id: org.id, site_id: site.id, text: "best plumber in austin", status: "active", source: "manual" },
    {
      org_id: org.id,
      site_id: site.id,
      text: "emergency plumber austin",
      status: "active",
      source: "manual",
    },
    { org_id: org.id, site_id: site.id, text: "paused prompt", status: "paused", source: "manual" },
    { org_id: org.id, site_id: site.id, text: "suggested prompt", status: "suggested", source: "suggested" },
  ]);
});

beforeEach(async () => {
  calls.length = 0;
  answerCost = 0.01;
  await admin().from("llm_usage").delete().eq("site_id", ctx.siteId);
  await admin().from("site_settings").update({ monthly_ai_budget_usd: 25 }).eq("site_id", ctx.siteId);
});

describe("visibility-run job", () => {
  it("asks active prompts N times per provider, parses, and stores results + usage", async () => {
    const { result, run, runId } = await startRun(2);
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2 * 2 * 2); // 2 active prompts × 2 providers × 2 samples
    expect(calls.some((c) => c.includes("paused") || c.includes("suggested"))).toBe(false);
    expect(run).toMatchObject({
      status: "completed",
      planned_calls: 8,
      completed_calls: 8,
      failed_calls: 0,
      prompt_count: 2,
    });
    expect(Number(run.cost_usd)).toBeCloseTo(8 * (0.01 + 0.002), 4);

    const { data: results } = await admin().from("visibility_results").select("*").eq("run_id", runId);
    expect(results).toHaveLength(8);
    const openai = results!.find((r) => r.provider === "openai")!;
    expect(openai).toMatchObject({
      status: "ok",
      brand_mentioned: true,
      brand_position: 2,
      listed_count: 2,
      our_domain_cited: true,
      competitors_mentioned: ["Bolt Plumbing"],
      parse_status: "parsed",
    });
    expect(openai.cited_domains).toEqual(["yelp.com", "acmeplumbing.com"]);
    const pplx = results!.find((r) => r.provider === "perplexity")!;
    expect(pplx.brand_mentioned).toBe(false);

    const { data: usage } = await admin().from("llm_usage").select("purpose").eq("visibility_run_id", runId);
    expect(usage!.filter((u) => u.purpose === "visibility_answer")).toHaveLength(8);
    expect(usage!.filter((u) => u.purpose === "visibility_parse")).toHaveLength(8);
  });

  it("aggregates: trend shows sample sizes; cited domains and prompt gaps", async () => {
    const range = {
      p_site_id: ctx.siteId,
      p_from: new Date(Date.now() - 864e5).toISOString(),
      p_to: new Date(Date.now() + 864e5).toISOString(),
    };
    const { data: trend } = await admin().rpc("visibility_trend", { ...range, p_bucket: "week" });
    const openai = trend!.filter((t) => t.provider === "openai");
    expect(openai.reduce((s, t) => s + Number(t.samples), 0)).toBeGreaterThanOrEqual(4);
    expect(openai.every((t) => Number(t.brand_mentions) === Number(t.samples))).toBe(true);
    const pp = trend!.filter((t) => t.provider === "perplexity");
    expect(pp.every((t) => Number(t.brand_mentions) === 0)).toBe(true);

    const { data: domains } = await admin().rpc("visibility_cited_domains", { ...range, p_limit: 10 });
    expect(domains!.map((d) => d.domain)).toEqual(
      expect.arrayContaining(["yelp.com", "acmeplumbing.com", "bbb.org"]),
    );

    const { data: stats } = await admin().rpc("visibility_prompt_stats", range);
    const ppStat = stats!.find((s) => s.provider === "perplexity")!;
    expect(Number(ppStat.brand_mentions)).toBe(0);
    expect(ppStat.top_competitors).toEqual(["Bolt Plumbing"]);
  });

  it("refuses to start when the estimate exceeds the remaining budget", async () => {
    await admin().from("site_settings").update({ monthly_ai_budget_usd: 0.05 }).eq("site_id", ctx.siteId);
    const { run } = await startRun(2);
    expect(run.status).toBe("budget_blocked");
    expect(run.error).toMatch(/exceed this month's remaining budget/);
    expect(calls).toHaveLength(0);
  });

  it("stops mid-run when actual spend reaches the cap", async () => {
    // Estimate fits, but each real answer costs far more than estimated.
    await admin().from("site_settings").update({ monthly_ai_budget_usd: 1.5 }).eq("site_id", ctx.siteId);
    answerCost = 0.5;
    const { run } = await startRun(2);
    expect(run.status).toBe("partial");
    expect(run.error).toMatch(/monthly budget/);
    expect(run.completed_calls).toBeLessThan(8);
    expect(calls.length).toBeLessThan(8);
  });

  it("fails clearly with no active prompts", async () => {
    await admin().from("visibility_prompts").update({ status: "paused" }).eq("site_id", ctx.siteId);
    const { result, run } = await startRun(1);
    expect(result.ok).toBe(false);
    expect(run).toMatchObject({ status: "failed", error: "No active prompts" });
    await admin()
      .from("visibility_prompts")
      .update({ status: "active" })
      .eq("site_id", ctx.siteId)
      .neq("status", "suggested")
      .neq("text", "paused prompt");
  });
});
