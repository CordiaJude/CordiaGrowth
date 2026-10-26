# CordiaGrowth

Multi-tenant SEO and GEO (generative engine optimization) automation: track how often AI assistants
mention and cite a business, fix what holds a site back, and publish content worth citing.

**Status:** Phase 1 (AI visibility tracker) on top of the Phase 0 foundation. Later phases add audits,
keyword planning, the content engine, off-site authority and reporting.

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

| Variable                               | Where it comes from                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `pnpm exec supabase status` → API URL (local) or Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `supabase status` → Publishable key (`sb_publishable_…`)                                     |
| `SUPABASE_SECRET_KEY`                  | `supabase status` → Secret key (`sb_secret_…`). Server-only; bypasses RLS.                   |
| `ENCRYPTION_KEYS`                      | `1:` + `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`         |
| `JOB_RUNNER`                           | `auto` (default): Trigger.dev if `TRIGGER_SECRET_KEY` is set, otherwise inline               |
| `TRIGGER_SECRET_KEY`                   | Trigger.dev dashboard → API keys (optional locally)                                          |
| `TRIGGER_PROJECT_REF`                  | Trigger.dev project ref, e.g. `proj_abc123` (only for `pnpm dev:trigger` / deploy)           |
| `ANTHROPIC_API_KEY` etc.               | Provider API keys for AI visibility; providers without a key are skipped (see below)         |
| `CRON_SECRET`                          | Random string; Vercel Cron sends it as a bearer token to `/api/cron/visibility`              |

Then open http://localhost:3000, create an account, create an organization, add a site and press
**Run test job** on the site page.

## AI visibility (Phase 1)

Per site: track prompts (questions customers ask AI assistants), ask each one several times on each
enabled assistant, and measure how often the brand is mentioned, where it ranks, which competitors
appear, and which sources get cited.

| Assistant  | API                                          | Web search                                   | Notes                                                                                                                       |
| ---------- | -------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Claude     | Anthropic Messages API (`@anthropic-ai/sdk`) | `web_search_20260318` server tool            | Refusal fallbacks enabled (`fallbacks: "default"`).                                                                         |
| ChatGPT    | OpenAI Responses API (`fetch`)               | `web_search` tool, `tool_choice: "required"` | `store: false`.                                                                                                             |
| Gemini     | Gemini API `generateContent` (`fetch`)       | **Off**                                      | The Gemini API terms prohibit storing, analyzing or link-tracking Grounded Results, so Gemini answers from model knowledge. |
| Perplexity | Agent API `/v1/agent` (`fetch`)              | `web_search` tool                            | Sonar chat completions was deprecated on 2026-09-27. Cost comes from Perplexity's own `usage.cost`.                         |

Model IDs, tool versions, prices and per-answer cost estimates live in `src/config/ai.ts`, and model
IDs can be overridden with env vars. Check the prices there when providers change them.

**How a run works** (`src/jobs/visibility-run.ts`):

1. It loads active prompts, the brand profile (name, aliases, domains) and competitors.
2. It estimates the cost. If the estimate doesn't fit the site's remaining monthly budget, the run is
   marked `budget_blocked` and nothing is called.
3. It asks prompts × providers × samples (default 3), with up to 4 calls in parallel. Each call is
   logged in `llm_usage` with tokens, searches and cost.
4. Each answer is parsed with Claude using structured output: which businesses it names, in what
   order, and which are us or a competitor. Deterministic checks then:
   - drop names that don't appear in the answer text;
   - only accept competitor labels from the site's own list;
   - count a literal brand mention even when parsing fails.
5. Results go to `visibility_results`. The run stops early, with status `partial`, if actual spend
   reaches the budget.

**Prompt suggestions:** "Suggest 20 starter prompts" reads the homepage through the SSRF-safe fetch,
along with the business details, and asks Claude for prompts. They are stored as `suggested` and
tracked only after someone accepts them. (The Phase 2 crawl will feed this later.)

**Dashboard:**

- Mention rate per assistant with sample size (n), a 95% Wilson confidence range and the date range.
- Share of voice against tracked competitors.
- A weekly trend chart; the tooltip shows n.
- Prompts where an assistant never mentions you.
- The most-cited domains.
- Recent runs, each with the full answers and their citations.

**Schedule:** `vercel.json` runs `/api/cron/visibility` daily at 06:17 UTC (Hobby plans allow one cron
run per day). It starts a run for each site whose frequency (daily, weekly or monthly) is due. Set
`CRON_SECRET` in Vercel. To trigger it locally:
`curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/visibility`.

**Costs:** with the default models, expect roughly $0.03–$0.12 per answer, parsing included. For
example, 20 prompts × 4 assistants × 3 samples is about $15 per run. Choose the frequency and the
monthly budget (default $25) with that in mind. The parser model is the biggest lever you control:
set `VISIBILITY_PARSER_MODEL=claude-haiku-5-5` to cut parsing cost sharply.

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

Migrations live in `supabase/migrations/`. Phase 0 adds `profiles`, `organizations`, `memberships`
(owner/editor/viewer), `sites`, `site_settings`, `integrations` and `job_runs`. Phase 1 adds
`brand_profiles`, `competitors`, `visibility_prompts`, `visibility_runs`, `visibility_results`,
`llm_usage`, and the aggregate functions `visibility_trend`, `visibility_cited_domains`,
`visibility_prompt_stats` and `site_ai_spend_this_month`. The aggregate functions run as the caller,
so RLS applies.

How tenancy is enforced:

- Every tenant table has an `org_id` column. Each RLS policy is one `private.is_org_member(org_id, min_role)` call.
- Organizations can only be created through `create_organization()`, which makes the caller the owner.
- Supabase's default `ALL` grants are revoked. Users get column-level grants only, so tenancy and
  ownership columns (`org_id`, `user_id`, `slug`, `created_by`) can't be changed.
- Triggers reject a row that points at another org's site, and stop an org from losing its last owner.
- Each new site gets `site_settings` with **auto-publish off**.
- `integrations.encrypted_credentials` can never be selected by end users.
- Background workers write `job_runs` with the secret key. Users can only enqueue jobs (editor or owner).
- Visibility results and usage rows are written only by workers. Users can't forge results, mark
  runs complete, start "scheduled" runs, or insert prompts that claim to be AI suggestions.

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
pnpm test        # unit: encryption, domains, SSRF guard, stats, citations, answer analysis, providers (mocked fetch)
pnpm test:db     # RLS, job runtime, visibility run job (fake providers) against local Supabase
pnpm test:e2e    # Playwright: Phase 0 flow + visibility prompts/competitors/settings (needs build + db + internet)
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
