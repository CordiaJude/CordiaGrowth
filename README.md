# CordiaGrowth

Multi-tenant SEO and GEO (generative engine optimization) automation: track how often AI assistants
mention and cite a business, fix what holds a site back, and publish content worth citing.

**Status:** Phase 0 (foundation). Sign up, create an organization, add sites, switch between them, and
run a background test job. Later phases add AI visibility tracking, audits, keyword planning, the content
engine, off-site authority and reporting.

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui
- Supabase: Postgres, Auth (email + password), Row Level Security on every tenant table
- Trigger.dev v4 for background jobs (with an inline fallback for local development)
- Vitest (unit + database tests), Playwright (end-to-end)
- Vercel for hosting

## Local setup

Requirements: Node 20.9+, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start                 # local Postgres + Auth + REST in Docker; applies migrations
cp .env.example .env.local    # then fill in the values below
pnpm dev                      # http://localhost:3000
```

Fill `.env.local`:

| Variable                               | Where it comes from                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `pnpm exec supabase status` → API URL (local) or Supabase dashboard → Project Settings → API        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `supabase status` → Publishable key (`sb_publishable_…`)                                             |
| `SUPABASE_SECRET_KEY`                  | `supabase status` → Secret key (`sb_secret_…`). Server-only; bypasses RLS.                           |
| `ENCRYPTION_KEYS`                      | `1:` + `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`                |
| `JOB_RUNNER`                           | `auto` (default): Trigger.dev if `TRIGGER_SECRET_KEY` is set, otherwise inline                       |
| `TRIGGER_SECRET_KEY`                   | Trigger.dev dashboard → API keys (optional locally)                                                  |
| `TRIGGER_PROJECT_REF`                  | Trigger.dev project ref, e.g. `proj_abc123` (only for `pnpm dev:trigger` / deploy)                   |

Then open http://localhost:3000, create an account, create an organization, add a site and press
**Run test job** on the site page.

## Background jobs

Job logic lives in `src/jobs/` as plain functions with no Next.js imports. Each run has a row in
`job_runs` (status, logs, output, cost) that the UI polls.

- **Trigger.dev (production):** `src/trigger/*.ts` wraps each job as a Trigger.dev task. The app
  creates the `job_runs` row, then calls `tasks.trigger()`. To run it:
  1. Create a free project at [trigger.dev](https://trigger.dev). Set `TRIGGER_PROJECT_REF` and
     `TRIGGER_SECRET_KEY` (a dev key locally).
  2. `pnpm dev:trigger` runs tasks on your machine. `pnpm deploy:trigger` deploys them.
  3. In the Trigger.dev dashboard, set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` as
     environment variables, because tasks write their results to Supabase.
- **Inline (local development):** with no Trigger.dev key, jobs run in the Next.js process after the
  response (`after()`). This is fine for the test job but not for long crawls. Don't rely on it in
  production.

Why Trigger.dev over Inngest: crawls, multi-provider prompt runs and article generation need minutes
of compute and, for JS-rendering checks, a headless browser. Trigger.dev runs tasks on its own
machines with no serverless timeout, supports Playwright, and has per-tenant queues and concurrency
keys built in. With Inngest, each step runs inside our Vercel functions and has to fit their time
limit.

## Database

Migrations live in `supabase/migrations/`. The tables are `profiles`, `organizations`, `memberships`
(owner/editor/viewer), `sites`, `site_settings`, `integrations` and `job_runs`. Later phases add their
own tables when they need them.

How tenancy is enforced:

- Every tenant table has an `org_id` column. Each RLS policy is one `private.is_org_member(org_id, min_role)` call.
- Organizations can only be created through `create_organization()`, which makes the caller the owner.
- Supabase's default `ALL` grants are revoked. Users get column-level grants only, so tenancy and
  ownership columns (`org_id`, `user_id`, `slug`, `created_by`) can't be changed.
- Triggers reject a row that points at another org's site, and stop an org from losing its last owner.
- Each new site gets `site_settings` with **auto-publish off**.
- `integrations.encrypted_credentials` can never be selected by end users.
- Background workers write `job_runs` with the secret key. Users can only enqueue jobs (editor or owner).

Useful commands:

```bash
pnpm db:reset      # rebuild the local DB from migrations
pnpm db:types      # regenerate src/lib/supabase/database.types.ts after a migration
pnpm exec supabase db lint --level warning
```

### Hosted Supabase project

1. Create a project, then `pnpm exec supabase link --project-ref <ref>` and `pnpm exec supabase db push`.
2. Turn off email confirmation: Dashboard → Authentication → Sign In / Providers → Email → turn off
   **Confirm email**. Or run `pnpm exec supabase config push`, which pushes `supabase/config.toml`,
   where `enable_confirmations = false`.
3. Set the minimum password length to 8, to match the app.

## Security notes

- **Secrets at rest:** OAuth tokens and CMS credentials are encrypted with AES-256-GCM using versioned
  keys from `ENCRYPTION_KEYS` (`src/lib/crypto/encryption.ts`). The integration's site and provider
  are bound as associated data, so ciphertext copied to another row won't decrypt. To rotate keys, add
  a higher version; old versions keep decrypting.
- **Outbound fetches:** everything the crawler fetches goes through `safeFetch` (`src/lib/net/`). It
  resolves DNS at connect time and refuses private, loopback, link-local and metadata addresses on
  every redirect hop. It also caps response size and time.
- **Auth:** pages use `getClaims()`, which verifies the JWT, through `src/lib/data/auth.ts`. The proxy
  (`src/proxy.ts`) refreshes sessions and redirects signed-out users. Server actions re-check
  membership and role.
- **Secrets in git:** `.env*` files are git-ignored except `.env.example`.

## Tests

```bash
pnpm test        # unit: encryption, domain normalization, IP/SSRF guard, helpers
pnpm test:db     # RLS and job runtime against local Supabase (needs pnpm db:start)
pnpm test:e2e    # Playwright: sign up → org → site → test job (needs build + db + internet)
```

For e2e, run `pnpm build` first. If Playwright's browser isn't installed, run
`pnpm exec playwright install chromium`, or set `PW_CHROMIUM_PATH` to an existing Chromium.

CI (`.github/workflows/ci.yml`) runs formatting, lint, typecheck, unit tests and the build. It then
starts Supabase and runs the generated-types drift check, DB lint, RLS tests and the e2e test.

## Project layout

```
src/
  app/                 routes: (auth), onboarding, orgs/new, o/[orgSlug]/…, s/[siteId]/…
  components/          shell (sidebar, switchers), forms, sites, ui (shadcn)
  jobs/                job handlers + runtime (framework-free; run in Trigger.dev or inline)
  trigger/             Trigger.dev task wrappers
  lib/
    actions/           server actions (orgs, sites)
    crypto/            encryption at rest
    data/              data access layer (auth, orgs, sites)
    jobs/dispatch.ts   enqueue: job_runs row + Trigger.dev or inline
    net/               SSRF-safe fetch
    supabase/          clients (server, browser, admin, proxy) + generated types
supabase/              config.toml + migrations
tests/                 unit, db, e2e
```

## Product guardrails (apply to every phase)

- No link schemes: no link exchanges, automated link placement between customer sites, or paid links.
- Nothing publishes without approval by default. Auto-publish is opt-in per site and still runs every
  quality gate.
- Generated content never invents statistics, quotes, reviews, prices or credentials. Any factual
  claim without a source is flagged for human review.
- Every AI-visibility metric shows its sample size and date range.
