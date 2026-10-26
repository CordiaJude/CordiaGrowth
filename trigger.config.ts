import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Set TRIGGER_PROJECT_REF (e.g. "proj_abc123") from the Trigger.dev dashboard.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_set_TRIGGER_PROJECT_REF",
  dirs: ["./src/trigger"],
  runtime: "node",
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
