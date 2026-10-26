import { task } from "@trigger.dev/sdk";
import { executeJobRun } from "../jobs/runtime";
import { VISIBILITY_RUN, visibilityRun } from "../jobs/visibility-run";
import { VISIBILITY_SUGGEST, visibilitySuggestPrompts } from "../jobs/visibility-suggest";

export const visibilityRunTask = task({
  id: VISIBILITY_RUN,
  maxDuration: 3600,
  // A retry would re-ask every prompt and double-spend; the job records partial results instead.
  retry: { maxAttempts: 1 },
  queue: { concurrencyLimit: 5 },
  run: async (payload: { jobRunId: string }) => {
    const result = await executeJobRun(payload.jobRunId, visibilityRun);
    if (!result.ok) throw new Error(result.error);
    return result.output;
  },
});

export const visibilitySuggestTask = task({
  id: VISIBILITY_SUGGEST,
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  run: async (payload: { jobRunId: string }) => {
    const result = await executeJobRun(payload.jobRunId, visibilitySuggestPrompts);
    if (!result.ok) throw new Error(result.error);
    return result.output;
  },
});
