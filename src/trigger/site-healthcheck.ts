import { task } from "@trigger.dev/sdk";
import { executeJobRun } from "../jobs/runtime";
import { SITE_HEALTHCHECK, siteHealthcheck } from "../jobs/site-healthcheck";

export const siteHealthcheckTask = task({
  id: SITE_HEALTHCHECK,
  maxDuration: 120,
  // The job records its own failure; network errors are not worth retrying here.
  retry: { maxAttempts: 1 },
  run: async (payload: { jobRunId: string }) => {
    const result = await executeJobRun(payload.jobRunId, siteHealthcheck);
    if (!result.ok) throw new Error(result.error);
    return result.output;
  },
});
