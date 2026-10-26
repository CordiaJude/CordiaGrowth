"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { normalizeDomain } from "@/lib/domain";
import { enqueueJob } from "@/lib/jobs/dispatch";
import { createClient } from "@/lib/supabase/server";
import { CMS_TYPES } from "@/lib/constants";
import { SITE_HEALTHCHECK } from "@/jobs/site-healthcheck";

export type CreateSiteState = { error?: string; fields?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(1, "Enter a site name").max(100),
  domain: z.string().trim().min(1, "Enter the site's domain").max(300),
  cms_type: z.enum(CMS_TYPES.map((c) => c.value) as [string, ...string[]]),
  business_type: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/, "Use a 2-letter country code, like US")
    .optional(),
});

export async function createSite(
  orgSlug: string,
  _prev: CreateSiteState,
  formData: FormData,
): Promise<CreateSiteState> {
  const user = await requireUser();
  const fields = Object.fromEntries(
    ["name", "domain", "cms_type", "business_type", "city", "region", "country"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );

  const org = await getOrgBySlug(orgSlug);
  if (!hasRole(org.role, "editor"))
    return { error: "Viewers can't add sites. Ask an owner for editor access.", fields };

  const parsed = schema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const domain = normalizeDomain(parsed.data.domain);
  if (!domain.ok) return { error: domain.error, fields };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .insert({
      org_id: org.id,
      name: parsed.data.name,
      domain: domain.domain,
      cms_type: parsed.data.cms_type as (typeof CMS_TYPES)[number]["value"],
      business_type: parsed.data.business_type || null,
      city: parsed.data.city || null,
      region: parsed.data.region || null,
      country: parsed.data.country || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: `${domain.domain} is already in this organization.`, fields };
    return { error: error.message, fields };
  }
  revalidatePath(`/o/${orgSlug}`, "layout");
  redirect(`/o/${orgSlug}/s/${data.id}`);
}

export type RunJobState = { error?: string; ok?: boolean };

export async function runHealthcheck(orgSlug: string, siteId: string): Promise<RunJobState> {
  const user = await requireUser();
  const org = await getOrgBySlug(orgSlug);
  if (!hasRole(org.role, "editor")) return { error: "Viewers can't run jobs." };
  const site = await getSite(org.id, siteId);
  try {
    await enqueueJob({ orgId: org.id, siteId: site.id, taskId: SITE_HEALTHCHECK, userId: user.id });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/o/${orgSlug}/s/${siteId}`);
  return { ok: true };
}
