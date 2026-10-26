import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type VisibilityPrompt = Database["public"]["Tables"]["visibility_prompts"]["Row"];
export type VisibilityRun = Database["public"]["Tables"]["visibility_runs"]["Row"];
export type VisibilityResult = Database["public"]["Tables"]["visibility_results"]["Row"];

export const RANGES = { "30d": 30, "90d": 90, "180d": 180 } as const;
export type RangeKey = keyof typeof RANGES;

export function resolveRange(value: unknown): { key: RangeKey; from: Date; to: Date } {
  const key = (typeof value === "string" && value in RANGES ? value : "90d") as RangeKey;
  const to = new Date();
  const from = new Date(to.getTime() - RANGES[key] * 24 * 3600_000);
  return { key, from, to };
}

export async function getVisibilityData(siteId: string, from: Date, to: Date) {
  const supabase = await createClient();
  const range = { p_site_id: siteId, p_from: from.toISOString(), p_to: to.toISOString() };
  const [trend, domains, promptStats, prompts, runs, spend, settings, brand, competitors] = await Promise.all(
    [
      supabase.rpc("visibility_trend", { ...range, p_bucket: "week" }),
      supabase.rpc("visibility_cited_domains", { ...range, p_limit: 25 }),
      supabase.rpc("visibility_prompt_stats", range),
      supabase.from("visibility_prompts").select("*").eq("site_id", siteId).order("created_at"),
      supabase
        .from("visibility_runs")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.rpc("site_ai_spend_this_month", { p_site_id: siteId }),
      supabase.from("site_settings").select("*").eq("site_id", siteId).single(),
      supabase.from("brand_profiles").select("*").eq("site_id", siteId).single(),
      supabase.from("competitors").select("*").eq("site_id", siteId).order("name"),
    ],
  );
  for (const r of [trend, domains, promptStats, prompts, runs, spend, settings, brand, competitors]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    trend: trend.data ?? [],
    domains: domains.data ?? [],
    promptStats: promptStats.data ?? [],
    prompts: prompts.data ?? [],
    runs: runs.data ?? [],
    spentThisMonth: Number(spend.data ?? 0),
    settings: settings.data!,
    brand: brand.data!,
    competitors: competitors.data ?? [],
  };
}

export async function getRunWithResults(siteId: string, runId: string) {
  const supabase = await createClient();
  const [{ data: run }, { data: results }, { data: prompts }] = await Promise.all([
    supabase.from("visibility_runs").select("*").eq("site_id", siteId).eq("id", runId).maybeSingle(),
    supabase
      .from("visibility_results")
      .select("*")
      .eq("site_id", siteId)
      .eq("run_id", runId)
      .order("created_at"),
    supabase.from("visibility_prompts").select("id, text").eq("site_id", siteId),
  ]);
  return { run, results: results ?? [], prompts: new Map((prompts ?? []).map((p) => [p.id, p.text])) };
}

export async function getUsageLog(siteId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("llm_usage")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
