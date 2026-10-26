import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Site = Database["public"]["Tables"]["sites"]["Row"];
export type JobRun = Database["public"]["Tables"]["job_runs"]["Row"];

export const listSites = cache(async (orgId: string): Promise<Site[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sites").select("*").eq("org_id", orgId).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getSite = cache(async (orgId: string, siteId: string): Promise<Site> => {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", siteId)
    .maybeSingle();
  if (!data) notFound();
  return data;
});

export async function listRecentJobRuns(siteId: string, limit = 10): Promise<JobRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_runs")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
