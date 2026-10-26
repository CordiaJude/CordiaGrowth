import { createAdminClient } from "../lib/supabase/admin";
import type { Json } from "../lib/supabase/database.types";

// Job code runs both inside Trigger.dev workers and (in local dev) inside the
// Next.js process, so it must not import "server-only" or Next.js APIs.

export type JobLogLevel = "info" | "warn" | "error";
export type JobLogEntry = { at: string; level: JobLogLevel; message: string };

export type JobContext = {
  jobRunId: string;
  orgId: string;
  siteId: string | null;
  payload: Json;
  log: (message: string, level?: JobLogLevel) => Promise<void>;
};

export type JobOutput = { [key: string]: Json | undefined };
export type JobHandler = (ctx: JobContext) => Promise<JobOutput>;

const asJson = (value: unknown) => value as NonNullable<Json>;

/**
 * Runs a handler against a job_runs row: marks it running, streams log lines
 * into the row, and records the output or error. Never throws for handler
 * failures (the failure is recorded instead) so callers can decide on retries.
 */
export async function executeJobRun(
  jobRunId: string,
  handler: JobHandler,
): Promise<{ ok: boolean; output?: JobOutput; error?: string }> {
  const db = createAdminClient();

  const { data: run, error: loadError } = await db
    .from("job_runs")
    .update({ status: "running", started_at: new Date().toISOString(), error: null })
    .eq("id", jobRunId)
    .in("status", ["queued", "running"])
    .select("id, org_id, site_id, payload")
    .single();
  if (loadError || !run) {
    return { ok: false, error: `Job run ${jobRunId} not found or already finished` };
  }

  const logs: JobLogEntry[] = [];
  const log = async (message: string, level: JobLogLevel = "info") => {
    logs.push({ at: new Date().toISOString(), level, message });
    await db
      .from("job_runs")
      .update({ logs: asJson(logs) })
      .eq("id", jobRunId);
  };

  try {
    const output = await handler({
      jobRunId,
      orgId: run.org_id,
      siteId: run.site_id,
      payload: run.payload,
      log,
    });
    await db
      .from("job_runs")
      .update({
        status: "succeeded",
        output,
        logs: asJson(logs),
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobRunId);
    return { ok: true, output };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push({ at: new Date().toISOString(), level: "error", message });
    await db
      .from("job_runs")
      .update({
        status: "failed",
        error: message,
        logs: asJson(logs),
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobRunId);
    return { ok: false, error: message };
  }
}
