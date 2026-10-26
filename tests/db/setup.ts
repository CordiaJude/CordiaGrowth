import { readFileSync, existsSync } from "node:fs";

// Load .env.local (if present) so DB tests hit the local Supabase stack.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
  throw new Error(`DB tests only run against a local Supabase stack (got "${url}")`);
}
