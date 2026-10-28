/**
 * Required environment variables, checked at request time so a deployment
 * missing configuration shows what to fix instead of a bare 500.
 * Only names are ever reported, never values.
 */
const REQUIRED = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    hint: "Supabase project URL (Project Settings → API). Redeploy after setting: it is built into the app.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    hint: "Supabase publishable key (sb_publishable_…). Redeploy after setting.",
  },
  { name: "SUPABASE_SECRET_KEY", hint: "Supabase secret key (sb_secret_…). Server-only." },
  {
    name: "ENCRYPTION_KEYS",
    hint: '"1:" followed by a base64 32-byte key, e.g. from: openssl rand -base64 32',
  },
] as const;

export type MissingVar = { name: string; hint: string };

// NEXT_PUBLIC_ values must be read with literal property access so Next.js can
// inline them at build time.
function current(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ENCRYPTION_KEYS: process.env.ENCRYPTION_KEYS,
  };
}

export function missingConfig(env: Record<string, string | undefined> = current()): MissingVar[] {
  return REQUIRED.filter((v) => !env[v.name]?.trim()).map((v) => ({ name: v.name, hint: v.hint }));
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal self-contained page explaining which settings are missing. */
export function setupRequiredHtml(missing: MissingVar[]): string {
  const items = missing
    .map((m) => `<li><code>${escape(m.name)}</code><span>${escape(m.hint)}</span></li>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup required · CordiaGrowth</title>
<style>
:root{color-scheme:light dark;--bg:#fafafa;--fg:#171717;--muted:#666;--card:#fff;--border:#e5e5e5}
@media (prefers-color-scheme:dark){:root{--bg:#0a0a0a;--fg:#ededed;--muted:#a3a3a3;--card:#171717;--border:#262626}}
body{margin:0;min-height:100svh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:16px}
main{max-width:560px;width:100%;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px}
h1{font-size:20px;margin:0 0 8px}p{color:var(--muted);margin:0 0 16px}
ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}li{display:grid;gap:2px}
code{font:13px ui-monospace,monospace;font-weight:600}span{color:var(--muted);font-size:13px}
</style></head><body><main><h1>Setup required</h1>
<p>This deployment is missing environment variables. Add them in your hosting provider's project settings (Vercel → Settings → Environment Variables), then redeploy.</p>
<ul>${items}</ul></main></body></html>`;
}
