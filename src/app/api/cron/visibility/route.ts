import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSystemJob } from "@/lib/jobs/dispatch";
import { isDue, type Frequency } from "@/lib/visibility/schedule";
import { VISIBILITY_RUN } from "@/jobs/visibility-run";

// Long enough for inline runs started from here (local/dev); production uses Trigger.dev.
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily (Vercel Cron at 06:17 UTC, see vercel.json; Hobby plans allow one run per day): enqueue a scheduled visibility run for
 * every site whose run frequency says it is due and that has active prompts.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const db = createAdminClient();
  const { data: settings, error } = await db
    .from("site_settings")
    .select("site_id, org_id, visibility_run_frequency, visibility_runs_per_prompt, visibility_providers")
    .neq("visibility_run_frequency", "manual");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const started: string[] = [];
  const skipped: { siteId: string; reason: string }[] = [];
  for (const s of settings ?? []) {
    const [{ data: last }, { count: activePrompts }] = await Promise.all([
      db
        .from("visibility_runs")
        .select("created_at, status")
        .eq("site_id", s.site_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("visibility_prompts")
        .select("id", { count: "exact", head: true })
        .eq("site_id", s.site_id)
        .eq("status", "active"),
    ]);
    if (!activePrompts) {
      skipped.push({ siteId: s.site_id, reason: "no active prompts" });
      continue;
    }
    if (last && (last.status === "queued" || last.status === "running")) {
      skipped.push({ siteId: s.site_id, reason: "run in progress" });
      continue;
    }
    if (!isDue(s.visibility_run_frequency as Frequency, last ? new Date(last.created_at) : null)) continue;

    const { data: run, error: runError } = await db
      .from("visibility_runs")
      .insert({
        org_id: s.org_id,
        site_id: s.site_id,
        trigger: "scheduled",
        providers: s.visibility_providers,
        samples_per_prompt: s.visibility_runs_per_prompt,
      })
      .select("id")
      .single();
    if (runError || !run) {
      skipped.push({ siteId: s.site_id, reason: runError?.message ?? "insert failed" });
      continue;
    }
    try {
      const { jobRunId } = await enqueueSystemJob({
        orgId: s.org_id,
        siteId: s.site_id,
        taskId: VISIBILITY_RUN,
        payload: { visibilityRunId: run.id },
      });
      await db.from("visibility_runs").update({ job_run_id: jobRunId }).eq("id", run.id);
      started.push(s.site_id);
    } catch (e) {
      await db
        .from("visibility_runs")
        .update({ status: "failed", error: (e as Error).message, finished_at: new Date().toISOString() })
        .eq("id", run.id);
      skipped.push({ siteId: s.site_id, reason: (e as Error).message });
    }
  }
  return Response.json({ started, skipped });
}
