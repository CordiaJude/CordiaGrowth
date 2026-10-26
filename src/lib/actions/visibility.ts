"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { normalizeDomain } from "@/lib/domain";
import { enqueueJob } from "@/lib/jobs/dispatch";
import { createClient } from "@/lib/supabase/server";
import { PROVIDER_IDS } from "@/lib/ai/providers/ids";
import { VISIBILITY_RUN } from "@/jobs/visibility-run";
import { VISIBILITY_SUGGEST } from "@/jobs/visibility-suggest";

export type ActionState = { error?: string; ok?: string };

/** Resolves org + site for an editor action, or returns an error state. */
async function editorContext(orgSlug: string, siteId: string) {
  const user = await requireUser();
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);
  if (!hasRole(org.role, "editor")) return { error: "You need editor access to change this." } as const;
  return { user, org, site, supabase: await createClient() } as const;
}

function revalidateVisibility(orgSlug: string, siteId: string) {
  revalidatePath(`/o/${orgSlug}/s/${siteId}/visibility`, "layout");
}

const promptText = z
  .string()
  .trim()
  .min(3, "Prompts need at least 3 characters")
  .max(500, "Keep prompts under 500 characters");

/** Adds one prompt per non-empty line. Duplicates are skipped. */
export async function addPrompts(
  orgSlug: string,
  siteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const lines = String(formData.get("prompts") ?? "")
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (!lines.length) return { error: "Enter at least one prompt." };
  if (lines.length > 100) return { error: "Add at most 100 prompts at a time." };
  for (const line of lines) {
    const r = promptText.safeParse(line);
    if (!r.success) return { error: `"${line.slice(0, 60)}": ${r.error.issues[0].message}` };
  }

  const { data: existing } = await ctx.supabase
    .from("visibility_prompts")
    .select("text")
    .eq("site_id", siteId);
  const seen = new Set((existing ?? []).map((p) => p.text.toLowerCase()));
  const rows = [];
  for (const text of lines) {
    if (seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    rows.push({
      org_id: ctx.org.id,
      site_id: siteId,
      text,
      status: "active" as const,
      source: "manual" as const,
      created_by: ctx.user.id,
    });
  }
  if (rows.length) {
    const { error } = await ctx.supabase.from("visibility_prompts").insert(rows);
    if (error) return { error: error.message };
  }
  revalidateVisibility(orgSlug, siteId);
  const skipped = lines.length - rows.length;
  return {
    ok: `Added ${rows.length} prompt${rows.length === 1 ? "" : "s"}${skipped ? ` (${skipped} already tracked)` : ""}.`,
  };
}

export async function setPromptStatus(
  orgSlug: string,
  siteId: string,
  promptIds: string[],
  status: "active" | "paused",
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const ids = z.array(z.uuid()).max(500).safeParse(promptIds);
  if (!ids.success || !ids.data.length) return { error: "Select at least one prompt." };
  const { error } = await ctx.supabase
    .from("visibility_prompts")
    .update({ status })
    .eq("site_id", siteId)
    .in("id", ids.data);
  if (error) return { error: error.message };
  revalidateVisibility(orgSlug, siteId);
  return { ok: status === "active" ? "Prompts are now tracked." : "Prompts paused." };
}

export async function deletePrompts(
  orgSlug: string,
  siteId: string,
  promptIds: string[],
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const ids = z.array(z.uuid()).max(500).safeParse(promptIds);
  if (!ids.success || !ids.data.length) return { error: "Select at least one prompt." };
  const { error } = await ctx.supabase
    .from("visibility_prompts")
    .delete()
    .eq("site_id", siteId)
    .in("id", ids.data);
  if (error) return { error: error.message };
  revalidateVisibility(orgSlug, siteId);
  return { ok: "Deleted." };
}

export async function suggestPrompts(orgSlug: string, siteId: string): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  try {
    await enqueueJob({
      orgId: ctx.org.id,
      siteId,
      taskId: VISIBILITY_SUGGEST,
      payload: { count: 20 },
      userId: ctx.user.id,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateVisibility(orgSlug, siteId);
  return {
    ok: "Generating suggestions from your homepage and business info. They'll appear below for review.",
  };
}

export async function runVisibilityNow(orgSlug: string, siteId: string): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const { data: settings } = await ctx.supabase
    .from("site_settings")
    .select("*")
    .eq("site_id", siteId)
    .single();
  if (!settings) return { error: "Site settings not found." };

  const { data: active } = await ctx.supabase
    .from("visibility_runs")
    .select("id")
    .eq("site_id", siteId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (active?.length) return { error: "A run is already in progress for this site." };

  const { data: run, error } = await ctx.supabase
    .from("visibility_runs")
    .insert({
      org_id: ctx.org.id,
      site_id: siteId,
      providers: settings.visibility_providers,
      samples_per_prompt: settings.visibility_runs_per_prompt,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error || !run) return { error: error?.message ?? "Could not create the run." };

  try {
    await enqueueJob({
      orgId: ctx.org.id,
      siteId,
      taskId: VISIBILITY_RUN,
      payload: { visibilityRunId: run.id },
      userId: ctx.user.id,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateVisibility(orgSlug, siteId);
  return { ok: "Run started." };
}

const listField = (max: number) =>
  z
    .string()
    .transform((s) =>
      s
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(100)).max(max));

export async function updateBrandProfile(
  orgSlug: string,
  siteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const parsed = z
    .object({
      brand_name: z.string().trim().min(1, "Enter the brand name").max(100),
      aliases: listField(20),
      own_domains: listField(10),
    })
    .safeParse({
      brand_name: formData.get("brand_name"),
      aliases: String(formData.get("aliases") ?? ""),
      own_domains: String(formData.get("own_domains") ?? ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const domains: string[] = [];
  for (const d of parsed.data.own_domains) {
    const n = normalizeDomain(d);
    if (!n.ok) return { error: `${d}: ${n.error}` };
    if (!domains.includes(n.domain)) domains.push(n.domain);
  }
  if (!domains.includes(ctx.site.domain)) domains.unshift(ctx.site.domain);

  const { error } = await ctx.supabase
    .from("brand_profiles")
    .update({
      brand_name: parsed.data.brand_name,
      aliases: [...new Set(parsed.data.aliases)],
      own_domains: domains,
    })
    .eq("site_id", siteId);
  if (error) return { error: error.message };
  revalidateVisibility(orgSlug, siteId);
  return { ok: "Brand profile saved." };
}

export async function addCompetitor(
  orgSlug: string,
  siteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter a competitor name").max(100),
      domain: z.string().trim().max(300),
      aliases: listField(20),
    })
    .safeParse({
      name: formData.get("name"),
      domain: String(formData.get("domain") ?? ""),
      aliases: String(formData.get("aliases") ?? ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let domain: string | null = null;
  if (parsed.data.domain) {
    const n = normalizeDomain(parsed.data.domain);
    if (!n.ok) return { error: n.error };
    domain = n.domain;
  }
  const { error } = await ctx.supabase.from("competitors").insert({
    org_id: ctx.org.id,
    site_id: siteId,
    name: parsed.data.name,
    domain,
    aliases: parsed.data.aliases,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.code === "23505" ? "That competitor is already listed." : error.message };
  revalidateVisibility(orgSlug, siteId);
  return { ok: `Added ${parsed.data.name}.` };
}

export async function deleteCompetitor(
  orgSlug: string,
  siteId: string,
  competitorId: string,
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  if (!z.uuid().safeParse(competitorId).success) return { error: "Invalid competitor." };
  const { error } = await ctx.supabase
    .from("competitors")
    .delete()
    .eq("site_id", siteId)
    .eq("id", competitorId);
  if (error) return { error: error.message };
  revalidateVisibility(orgSlug, siteId);
  return { ok: "Removed." };
}

export async function updateVisibilitySettings(
  orgSlug: string,
  siteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await editorContext(orgSlug, siteId);
  if ("error" in ctx) return { error: ctx.error };
  const parsed = z
    .object({
      providers: z.array(z.enum(PROVIDER_IDS)).min(1, "Enable at least one provider"),
      frequency: z.enum(["daily", "weekly", "monthly", "manual"]),
      samples: z.coerce.number().int().min(1).max(10),
      budget: z.coerce.number().min(0).max(10_000),
    })
    .safeParse({
      providers: formData.getAll("providers"),
      frequency: formData.get("frequency"),
      samples: formData.get("samples"),
      budget: formData.get("budget"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await ctx.supabase
    .from("site_settings")
    .update({
      visibility_providers: parsed.data.providers,
      visibility_run_frequency: parsed.data.frequency,
      visibility_runs_per_prompt: parsed.data.samples,
      monthly_ai_budget_usd: parsed.data.budget,
    })
    .eq("site_id", siteId);
  if (error) return { error: error.message };
  revalidateVisibility(orgSlug, siteId);
  revalidatePath(`/o/${orgSlug}/s/${siteId}/settings`);
  return { ok: "Settings saved." };
}
