import "server-only";
import { after } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { executeJobRun } from "@/jobs/runtime";
import { jobHandlers, type JobTaskId } from "@/jobs/registry";

export type Runner = "trigger" | "inline";

export function resolveRunner(): Runner {
  const env = serverEnv();
  if (env.JOB_RUNNER === "trigger") return "trigger";
  if (env.JOB_RUNNER === "inline") return "inline";
  return env.TRIGGER_SECRET_KEY ? "trigger" : "inline";
}

type JobInput = {
  orgId: string;
  siteId: string | null;
  taskId: JobTaskId;
  payload?: Json;
};

/**
 * Records a job_runs row as the signed-in user (RLS enforces editor role and
 * tenancy), then starts it.
 */
export async function enqueueJob(
  input: JobInput & { userId: string },
): Promise<{ jobRunId: string; runner: Runner }> {
  const runner = resolveRunner();
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("job_runs")
    .insert({
      org_id: input.orgId,
      site_id: input.siteId,
      task_id: input.taskId,
      payload: input.payload ?? {},
      runner,
      triggered_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Could not create job run");
  await start(run.id, input.taskId, runner);
  return { jobRunId: run.id, runner };
}

/** Same as enqueueJob for system-initiated jobs (cron); caller must have authorized. */
export async function enqueueSystemJob(input: JobInput): Promise<{ jobRunId: string; runner: Runner }> {
  const runner = resolveRunner();
  const { data: run, error } = await createAdminClient()
    .from("job_runs")
    .insert({
      org_id: input.orgId,
      site_id: input.siteId,
      task_id: input.taskId,
      payload: input.payload ?? {},
      runner,
    })
    .select("id")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Could not create job run");
  await start(run.id, input.taskId, runner);
  return { jobRunId: run.id, runner };
}

/**
 * Hands a queued job to Trigger.dev, or runs it in-process after the response
 * when no Trigger.dev key is configured (local development).
 */
async function start(jobRunId: string, taskId: JobTaskId, runner: Runner) {
  if (runner === "inline") {
    after(() => executeJobRun(jobRunId, jobHandlers[taskId]));
    return;
  }
  const admin = createAdminClient();
  try {
    const handle = await tasks.trigger(taskId, { jobRunId });
    await admin.from("job_runs").update({ external_run_id: handle.id }).eq("id", jobRunId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("job_runs")
      .update({
        status: "failed",
        error: `Could not reach Trigger.dev: ${message}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobRunId);
    throw new Error("Could not start the job. Check the Trigger.dev configuration.");
  }
}
