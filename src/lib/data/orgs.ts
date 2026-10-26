import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { requireUser } from "./auth";

export type OrgRole = Database["public"]["Enums"]["org_role"];
export type OrgSummary = { id: string; name: string; slug: string; role: OrgRole };

const RANK: Record<OrgRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function hasRole(role: OrgRole, min: OrgRole): boolean {
  return RANK[role] >= RANK[min];
}

export const listMyOrgs = cache(async (): Promise<OrgSummary[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations!inner(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.organizations.id,
    name: m.organizations.name,
    slug: m.organizations.slug,
    role: m.role,
  }));
});

/** The org for a URL slug, if the current user is a member; 404 otherwise. */
export const getOrgBySlug = cache(async (slug: string): Promise<OrgSummary> => {
  const orgs = await listMyOrgs();
  const org = orgs.find((o) => o.slug === slug);
  if (!org) notFound();
  return org;
});
