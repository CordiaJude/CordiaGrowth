import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),
  // Comma-separated "version:base64key" pairs, e.g. "1:AbC...=,2:XyZ...=".
  // The highest version encrypts; every listed version can decrypt.
  ENCRYPTION_KEYS: z.string().min(1),
  // "trigger" sends jobs to Trigger.dev; "inline" runs them in the Next.js
  // process (local dev only); "auto" uses Trigger.dev when a key is set.
  JOB_RUNNER: z.enum(["auto", "trigger", "inline"]).default("auto"),
  TRIGGER_SECRET_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid server environment: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
