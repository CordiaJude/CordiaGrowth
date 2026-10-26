-- Phase 0 foundation: tenancy (organizations, memberships), profiles, sites,
-- site settings, integrations and job runs, with Row Level Security on every table.
--
-- Conventions
-- * Every tenant-owned table carries org_id so each RLS policy is a single
--   membership check, even where org_id could be derived through site_id.
-- * RLS helpers live in the `private` schema, which is not exposed via the Data API.
-- * Privileges are granted explicitly; anon gets nothing on tenant tables.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.org_role as enum ('owner', 'editor', 'viewer');

create type public.cms_type as enum (
  'wordpress', 'webflow', 'shopify', 'squarespace', 'wix', 'custom', 'other'
);

create type public.integration_provider as enum ('gsc', 'wordpress');

create type public.integration_status as enum ('pending', 'connected', 'error', 'revoked');

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'canceled');

create type public.run_frequency as enum ('daily', 'weekly', 'monthly', 'manual');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user; lets members see each other's name/email)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organizations and memberships
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- Rank roles so policies can ask for a minimum role.
create or replace function private.role_rank(r public.org_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case r when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 end;
$$;

-- True when the current user belongs to the org with at least min_role.
-- SECURITY DEFINER so policies on memberships don't recurse into themselves.
create or replace function private.is_org_member(
  p_org_id uuid,
  p_min_role public.org_role default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and private.role_rank(m.role) >= private.role_rank(p_min_role)
  );
$$;

-- True when the current user shares at least one org with p_user_id.
create or replace function private.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.is_org_member(uuid, public.org_role) from public, anon;
revoke all on function private.shares_org_with(uuid) from public, anon;
grant execute on function private.is_org_member(uuid, public.org_role) to authenticated, service_role;
grant execute on function private.shares_org_with(uuid) to authenticated, service_role;
grant execute on function private.role_rank(public.org_role) to authenticated, service_role;

-- Prevent an org from losing its last owner (demotion or removal).
create or replace function private.ensure_org_keeps_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := old.org_id;
begin
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;
  -- Allow cascades when the organization itself is being deleted.
  if not exists (select 1 from public.organizations o where o.id = v_org) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.org_id = v_org and m.role = 'owner' and m.user_id <> old.user_id
  ) then
    raise exception 'An organization must keep at least one owner'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_owner
before update or delete on public.memberships
for each row execute function private.ensure_org_keeps_owner();

-- Create an org and make the caller its owner, atomically.
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_user)
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, v_user, 'owner');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sites and per-site settings
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  -- Normalized host: lowercase, no scheme/path/port, no leading "www.".
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z0-9-]{2,}$' and char_length(domain) <= 253),
  cms_type public.cms_type not null default 'other',
  business_type text check (char_length(business_type) <= 100),
  city text check (char_length(city) <= 100),
  region text check (char_length(region) <= 100),
  country text check (char_length(country) <= 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, domain)
);

create index sites_org_id_idx on public.sites (org_id);

create trigger sites_set_updated_at
before update on public.sites
for each row execute function private.set_updated_at();

create table public.site_settings (
  site_id uuid primary key references public.sites (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Guardrail: nothing publishes without approval unless a site opts in.
  auto_publish boolean not null default false,
  monthly_ai_budget_usd numeric(10, 2) not null default 25.00 check (monthly_ai_budget_usd >= 0),
  visibility_run_frequency public.run_frequency not null default 'weekly',
  visibility_runs_per_prompt int not null default 3 check (visibility_runs_per_prompt between 1 and 10),
  content_pieces_per_week int not null default 2 check (content_pieces_per_week between 0 and 7),
  updated_at timestamptz not null default now()
);

create index site_settings_org_id_idx on public.site_settings (org_id);

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function private.set_updated_at();

create or replace function private.create_site_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_settings (site_id, org_id) values (new.id, new.org_id);
  return new;
end;
$$;

create trigger sites_create_settings
after insert on public.sites
for each row execute function private.create_site_settings();

-- ---------------------------------------------------------------------------
-- Integrations (credentials are encrypted by the app before storage; the
-- ciphertext column is never readable by end users)
-- ---------------------------------------------------------------------------

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'pending',
  encrypted_credentials text,
  key_version int,
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, provider)
);

create index integrations_org_id_idx on public.integrations (org_id);

create trigger integrations_set_updated_at
before update on public.integrations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Job runs (one row per background job; written by workers via service role)
-- ---------------------------------------------------------------------------

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid references public.sites (id) on delete cascade,
  task_id text not null check (char_length(task_id) <= 100),
  status public.job_status not null default 'queued',
  runner text not null default 'trigger' check (runner in ('trigger', 'inline')),
  external_run_id text,
  payload jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  logs jsonb not null default '[]'::jsonb,
  cost_usd numeric(10, 4) not null default 0,
  triggered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index job_runs_org_id_idx on public.job_runs (org_id);
create index job_runs_site_created_idx on public.job_runs (site_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- Supabase's default privileges grant ALL on new tables to anon and
-- authenticated. Revoke them so the column-level grants below are the only
-- privileges end users have, and so future tables start closed.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon;


-- Column-level update grants keep keys and tenancy columns immutable for end users.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, delete on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;
grant select, insert, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;
grant select, insert, delete on public.sites to authenticated;
grant update (name, domain, cms_type, business_type, city, region, country) on public.sites to authenticated;
grant select on public.site_settings to authenticated;
grant update (
  auto_publish, monthly_ai_budget_usd, visibility_run_frequency,
  visibility_runs_per_prompt, content_pieces_per_week
) on public.site_settings to authenticated;
grant select on public.job_runs to authenticated;
grant insert (org_id, site_id, task_id, payload, runner, triggered_by) on public.job_runs to authenticated;
-- Integrations: everything except the ciphertext; writes go through the server.
grant select (id, org_id, site_id, provider, status, metadata, last_error, created_at, updated_at)
  on public.integrations to authenticated;

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.site_settings enable row level security;
alter table public.integrations enable row level security;
alter table public.job_runs enable row level security;

-- profiles
create policy "profiles: read self or org-mates" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "profiles: update self" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- organizations (insert only via create_organization)
create policy "organizations: members read" on public.organizations
for select to authenticated
using (private.is_org_member(id));

create policy "organizations: owners update" on public.organizations
for update to authenticated
using (private.is_org_member(id, 'owner'))
with check (private.is_org_member(id, 'owner'));

create policy "organizations: owners delete" on public.organizations
for delete to authenticated
using (private.is_org_member(id, 'owner'));

-- memberships
create policy "memberships: members read" on public.memberships
for select to authenticated
using (private.is_org_member(org_id));

create policy "memberships: owners add" on public.memberships
for insert to authenticated
with check (private.is_org_member(org_id, 'owner'));

create policy "memberships: owners change roles" on public.memberships
for update to authenticated
using (private.is_org_member(org_id, 'owner'))
with check (private.is_org_member(org_id, 'owner'));

create policy "memberships: owners remove or self leave" on public.memberships
for delete to authenticated
using (private.is_org_member(org_id, 'owner') or user_id = (select auth.uid()));

-- sites
create policy "sites: members read" on public.sites
for select to authenticated
using (private.is_org_member(org_id));

create policy "sites: editors create" on public.sites
for insert to authenticated
with check (private.is_org_member(org_id, 'editor') and created_by = (select auth.uid()));

create policy "sites: editors update" on public.sites
for update to authenticated
using (private.is_org_member(org_id, 'editor'))
with check (private.is_org_member(org_id, 'editor'));

create policy "sites: owners delete" on public.sites
for delete to authenticated
using (private.is_org_member(org_id, 'owner'));

-- site_settings (rows created by trigger; org_id must match the site)
create policy "site_settings: members read" on public.site_settings
for select to authenticated
using (private.is_org_member(org_id));

create policy "site_settings: editors update" on public.site_settings
for update to authenticated
using (private.is_org_member(org_id, 'editor'))
with check (private.is_org_member(org_id, 'editor'));

-- integrations (read-only for members; writes via server with service role)
create policy "integrations: members read" on public.integrations
for select to authenticated
using (private.is_org_member(org_id));

-- job_runs (editors enqueue; workers update via service role)
create policy "job_runs: members read" on public.job_runs
for select to authenticated
using (private.is_org_member(org_id));

create policy "job_runs: editors enqueue" on public.job_runs
for insert to authenticated
with check (
  private.is_org_member(org_id, 'editor')
  and triggered_by = (select auth.uid())
  and status = 'queued'
  and (
    site_id is null
    or exists (select 1 from public.sites s where s.id = site_id and s.org_id = job_runs.org_id)
  )
);

-- Same cross-tenant guard for sites referenced by integrations.
create or replace function private.assert_site_in_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.site_id is not null and not exists (
    select 1 from public.sites s where s.id = new.site_id and s.org_id = new.org_id
  ) then
    raise exception 'site_id does not belong to org_id' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger integrations_site_in_org
before insert or update on public.integrations
for each row execute function private.assert_site_in_org();

create trigger job_runs_site_in_org
before insert or update on public.job_runs
for each row execute function private.assert_site_in_org();
