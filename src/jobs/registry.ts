import type { JobHandler } from "./runtime";
import { SITE_HEALTHCHECK, siteHealthcheck } from "./site-healthcheck";
import { VISIBILITY_RUN, visibilityRun } from "./visibility-run";
import { VISIBILITY_SUGGEST, visibilitySuggestPrompts } from "./visibility-suggest";

/** Every job the app can enqueue. Task ids match the Trigger.dev task ids. */
export const jobHandlers = {
  [SITE_HEALTHCHECK]: siteHealthcheck,
  [VISIBILITY_RUN]: visibilityRun,
  [VISIBILITY_SUGGEST]: visibilitySuggestPrompts,
} satisfies Record<string, JobHandler>;

export type JobTaskId = keyof typeof jobHandlers;

export function isJobTaskId(id: string): id is JobTaskId {
  return Object.hasOwn(jobHandlers, id);
}
