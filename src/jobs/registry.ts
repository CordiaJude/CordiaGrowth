import type { JobHandler } from "./runtime";
import { SITE_HEALTHCHECK, siteHealthcheck } from "./site-healthcheck";

/** Every job the app can enqueue. Task ids match the Trigger.dev task ids. */
export const jobHandlers = {
  [SITE_HEALTHCHECK]: siteHealthcheck,
} satisfies Record<string, JobHandler>;

export type JobTaskId = keyof typeof jobHandlers;

export function isJobTaskId(id: string): id is JobTaskId {
  return Object.hasOwn(jobHandlers, id);
}
