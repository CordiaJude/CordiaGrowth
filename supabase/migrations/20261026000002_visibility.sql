-- Phase 1: AI visibility tracker.
-- brand_profiles + competitors (who counts as "us" and "them"), tracked prompts,
-- runs/results of asking AI assistants those prompts, and an LLM usage ledger
-- that drives the per-site monthly budget cap.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.prompt_status as enum ('active', 'paused', 'suggested');
create type public.prompt_source as enum ('manual', 'suggested');
create type public.run_trigger as enum ('manual', 'scheduled');
create type public.visibility_run_status as enum (
  'queued', 'running', 'completed', 'partial', 'failed', 'budget_blocked'
);
create type public.result_status as enum ('ok', 'error', 'refused');
create type public.parse_status as enum ('parsed', 'failed', 'skipped');

-- Providers are text (not an enum) so new ones don't need a migration; the
-- app validates against its provider registry.

-- ---------------------------------------------------------------------------
-- Brand profile: names/aliases/domains that count as "our" brand
-- ---------------------------------------------------------------------------

create table public.brand_profiles (
  site_id uuid primary key references public.sites (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_name text not null check (char_length(brand_name) between 1 and 100),
  aliases text[] not null default '{}' check (cardinality(aliases) <= 20),
  own_domains text[] not null default '{}' check (cardinality(own_domains) <= 10),
  updated_at timestamptz not null default now()
);

create index brand_profiles_org_id_idx on public.brand_profiles (org_id);

create trigger brand_profiles_set_updated_at
before update on public.brand_profiles
for each row execute function private.set_updated_at();

create or replace function private.create_brand_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.brand_profiles (site_id, org_id, brand_name, own_domains)
  values (new.id, new.org_id, new.name, array[new.domain]);
  return new;
end;
$$;

create trigger sites_create_brand_profile
after insert on public.sites
for each row execute function private.create_brand_profile();

insert into public.brand_profiles (site_id, org_id, brand_name, own_domains)
select s.id, s.org_id, s.name, array[s.domain] from public.sites s
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Competitors
-- ---------------------------------------------------------------------------

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  domain text check (domain is null or (domain ~ '^[a-z0-9.-]+\.[a-z0-9-]{2,}$' and char_length(domain) <= 253)),
  aliases text[] not null default '{}' check (cardinality(aliases) <= 20),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index competitors_site_name_idx on public.competitors (site_id, lower(name));
create index competitors_org_id_idx on public.competitors (org_id);

-- ---------------------------------------------------------------------------
-- Tracked prompts
-- ---------------------------------------------------------------------------

create table public.visibility_prompts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  text text not null check (char_length(text) between 3 and 500),
  status public.prompt_status not null default 'active',
  source public.prompt_source not null default 'manual',
  -- Why a suggested prompt was proposed (shown to the user when reviewing).
  rationale text check (char_length(rationale) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index visibility_prompts_site_text_idx on public.visibility_prompts (site_id, lower(text));
create index visibility_prompts_org_id_idx on public.visibility_prompts (org_id);

create trigger visibility_prompts_set_updated_at
before update on public.visibility_prompts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Site settings: which providers to query
-- ---------------------------------------------------------------------------

alter table public.site_settings
  add column visibility_providers text[] not null
    default '{anthropic,openai,gemini,perplexity}'
    check (visibility_providers <@ array['anthropic', 'openai', 'gemini', 'perplexity']);

-- ---------------------------------------------------------------------------
-- Runs and results
-- ---------------------------------------------------------------------------

create table public.visibility_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  job_run_id uuid references public.job_runs (id) on delete set null,
  trigger public.run_trigger not null default 'manual',
  status public.visibility_run_status not null default 'queued',
  providers text[] not null default '{}',
  samples_per_prompt int not null default 3 check (samples_per_prompt between 1 and 10),
  prompt_count int not null default 0,
  planned_calls int not null default 0,
  completed_calls int not null default 0,
  failed_calls int not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index visibility_runs_site_created_idx on public.visibility_runs (site_id, created_at desc);
create index visibility_runs_org_id_idx on public.visibility_runs (org_id);

create table public.visibility_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  run_id uuid not null references public.visibility_runs (id) on delete cascade,
  prompt_id uuid not null references public.visibility_prompts (id) on delete cascade,
  provider text not null,
  model text not null,
  sample_index int not null check (sample_index >= 0),
  status public.result_status not null,
  answer_text text,
  cited_urls text[] not null default '{}',
  cited_domains text[] not null default '{}',
  brand_mentioned boolean,
  -- 1-based position of our brand among businesses listed in the answer.
  brand_position int check (brand_position is null or brand_position >= 1),
  listed_count int check (listed_count is null or listed_count >= 0),
  our_domain_cited boolean not null default false,
  competitors_mentioned text[] not null default '{}',
  -- Every business the answer recommended, in order: [{name, position, kind, competitor}]
  entities jsonb not null default '[]'::jsonb,
  parse_status public.parse_status not null default 'skipped',
  error text,
  latency_ms int,
  cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, prompt_id, provider, sample_index)
);

create index visibility_results_site_created_idx on public.visibility_results (site_id, created_at desc);
create index visibility_results_prompt_idx on public.visibility_results (prompt_id, created_at desc);
create index visibility_results_org_id_idx on public.visibility_results (org_id);

-- ---------------------------------------------------------------------------
-- LLM usage ledger (every paid AI call; drives the monthly budget cap)
-- ---------------------------------------------------------------------------

create table public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid references public.sites (id) on delete cascade,
  job_run_id uuid references public.job_runs (id) on delete set null,
  visibility_run_id uuid references public.visibility_runs (id) on delete set null,
  provider text not null,
  model text not null,
  purpose text not null check (char_length(purpose) <= 50),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  search_requests int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index llm_usage_site_created_idx on public.llm_usage (site_id, created_at desc);
create index llm_usage_org_id_idx on public.llm_usage (org_id);

-- Spend for a site in the current calendar month (UTC).
create or replace function public.site_ai_spend_this_month(p_site_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(u.cost_usd), 0)
  from public.llm_usage u
  where u.site_id = p_site_id
    and u.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates (security invoker: RLS on results applies)
-- ---------------------------------------------------------------------------

-- Per bucket (day/week/month) and provider: sample size, brand mentions,
-- competitor mentions. Callers compute rates and intervals from the counts.
create or replace function public.visibility_trend(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'week'
)
returns table (
  bucket timestamptz,
  provider text,
  samples bigint,
  brand_mentions bigint,
  competitor_mentions bigint,
  first_at timestamptz,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc(p_bucket, r.created_at) as bucket,
    r.provider,
    count(*) as samples,
    count(*) filter (where r.brand_mentioned) as brand_mentions,
    coalesce(sum(cardinality(r.competitors_mentioned)), 0) as competitor_mentions,
    min(r.created_at) as first_at,
    max(r.created_at) as last_at
  from public.visibility_results r
  where r.site_id = p_site_id
    and r.status = 'ok'
    and r.created_at >= p_from
    and r.created_at < p_to
    and p_bucket in ('day', 'week', 'month')
  group by 1, 2
  order by 1, 2;
$$;

-- Most-cited domains across answers (off-site targets later on).
create or replace function public.visibility_cited_domains(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 25
)
returns table (domain text, citations bigint, answers bigint, providers text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select d.domain,
         count(*) as citations,
         count(distinct r.id) as answers,
         array_agg(distinct r.provider order by r.provider) as providers
  from public.visibility_results r
  cross join lateral unnest(r.cited_domains) as d(domain)
  where r.site_id = p_site_id
    and r.status = 'ok'
    and r.created_at >= p_from
    and r.created_at < p_to
  group by d.domain
  order by count(distinct r.id) desc, d.domain
  limit least(greatest(p_limit, 1), 200);
$$;

-- Per prompt and provider: sample size and brand mentions (finds the gaps).
create or replace function public.visibility_prompt_stats(
  p_site_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  prompt_id uuid,
  provider text,
  samples bigint,
  brand_mentions bigint,
  best_position int,
  top_competitors text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.prompt_id,
         r.provider,
         count(*) as samples,
         count(*) filter (where r.brand_mentioned) as brand_mentions,
         min(r.brand_position) as best_position,
         (
           select array_agg(c order by n desc, c)
           from (
             select c, count(*) as n
             from public.visibility_results r2
             cross join lateral unnest(r2.competitors_mentioned) as c
             where r2.prompt_id = r.prompt_id and r2.provider = r.provider
               and r2.status = 'ok' and r2.created_at >= p_from and r2.created_at < p_to
             group by c
             order by n desc, c
             limit 3
           ) t
         ) as top_competitors
  from public.visibility_results r
  where r.site_id = p_site_id
    and r.status = 'ok'
    and r.created_at >= p_from
    and r.created_at < p_to
  group by r.prompt_id, r.provider;
$$;

-- ---------------------------------------------------------------------------
-- Cross-tenant guards
-- ---------------------------------------------------------------------------

create trigger brand_profiles_site_in_org
before insert or update on public.brand_profiles
for each row execute function private.assert_site_in_org();

create trigger competitors_site_in_org
before insert or update on public.competitors
for each row execute function private.assert_site_in_org();

create trigger visibility_prompts_site_in_org
before insert or update on public.visibility_prompts
for each row execute function private.assert_site_in_org();

create trigger visibility_runs_site_in_org
before insert or update on public.visibility_runs
for each row execute function private.assert_site_in_org();

create trigger visibility_results_site_in_org
before insert on public.visibility_results
for each row execute function private.assert_site_in_org();

create trigger llm_usage_site_in_org
before insert on public.llm_usage
for each row execute function private.assert_site_in_org();

-- ---------------------------------------------------------------------------
-- Privileges (default ALL grants were revoked in the foundation migration)
-- ---------------------------------------------------------------------------

grant select on public.brand_profiles to authenticated;
grant update (brand_name, aliases, own_domains) on public.brand_profiles to authenticated;

grant select, delete on public.competitors to authenticated;
grant insert (org_id, site_id, name, domain, aliases, created_by) on public.competitors to authenticated;
grant update (name, domain, aliases) on public.competitors to authenticated;

grant select, delete on public.visibility_prompts to authenticated;
grant insert (org_id, site_id, text, status, source, created_by) on public.visibility_prompts to authenticated;
grant update (text, status) on public.visibility_prompts to authenticated;

grant update (visibility_providers) on public.site_settings to authenticated;

grant select on public.visibility_runs to authenticated;
grant insert (org_id, site_id, trigger, providers, samples_per_prompt, created_by)
  on public.visibility_runs to authenticated;
grant select on public.visibility_results to authenticated;
grant select on public.llm_usage to authenticated;

grant all on public.brand_profiles, public.competitors, public.visibility_prompts,
  public.visibility_runs, public.visibility_results, public.llm_usage to service_role;

revoke all on function public.site_ai_spend_this_month(uuid) from public, anon;
revoke all on function public.visibility_trend(uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.visibility_cited_domains(uuid, timestamptz, timestamptz, int) from public, anon;
revoke all on function public.visibility_prompt_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.site_ai_spend_this_month(uuid) to authenticated, service_role;
grant execute on function public.visibility_trend(uuid, timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function public.visibility_cited_domains(uuid, timestamptz, timestamptz, int) to authenticated, service_role;
grant execute on function public.visibility_prompt_stats(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.brand_profiles enable row level security;
alter table public.competitors enable row level security;
alter table public.visibility_prompts enable row level security;
alter table public.visibility_runs enable row level security;
alter table public.visibility_results enable row level security;
alter table public.llm_usage enable row level security;

create policy "brand_profiles: members read" on public.brand_profiles
for select to authenticated using (private.is_org_member(org_id));
create policy "brand_profiles: editors update" on public.brand_profiles
for update to authenticated
using (private.is_org_member(org_id, 'editor'))
with check (private.is_org_member(org_id, 'editor'));

create policy "competitors: members read" on public.competitors
for select to authenticated using (private.is_org_member(org_id));
create policy "competitors: editors create" on public.competitors
for insert to authenticated
with check (private.is_org_member(org_id, 'editor') and created_by = (select auth.uid()));
create policy "competitors: editors update" on public.competitors
for update to authenticated
using (private.is_org_member(org_id, 'editor'))
with check (private.is_org_member(org_id, 'editor'));
create policy "competitors: editors delete" on public.competitors
for delete to authenticated using (private.is_org_member(org_id, 'editor'));

create policy "visibility_prompts: members read" on public.visibility_prompts
for select to authenticated using (private.is_org_member(org_id));
create policy "visibility_prompts: editors create" on public.visibility_prompts
for insert to authenticated
with check (
  private.is_org_member(org_id, 'editor')
  and created_by = (select auth.uid())
  and source = 'manual'
);
create policy "visibility_prompts: editors update" on public.visibility_prompts
for update to authenticated
using (private.is_org_member(org_id, 'editor'))
with check (private.is_org_member(org_id, 'editor'));
create policy "visibility_prompts: editors delete" on public.visibility_prompts
for delete to authenticated using (private.is_org_member(org_id, 'editor'));

create policy "visibility_runs: members read" on public.visibility_runs
for select to authenticated using (private.is_org_member(org_id));
create policy "visibility_runs: editors enqueue" on public.visibility_runs
for insert to authenticated
with check (
  private.is_org_member(org_id, 'editor')
  and created_by = (select auth.uid())
  and trigger = 'manual'
);

create policy "visibility_results: members read" on public.visibility_results
for select to authenticated using (private.is_org_member(org_id));

create policy "llm_usage: members read" on public.llm_usage
for select to authenticated using (private.is_org_member(org_id));
