import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

export function admin(): Client {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anon(): Client {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Creates a confirmed user and returns a client signed in as them. */
export async function newUser(label: string): Promise<{ id: string; email: string; client: Client }> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = "correct-horse-battery";
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function newOrg(client: Client, name: string) {
  const { data, error } = await client.rpc("create_organization", {
    p_name: name,
    p_slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 6)}`,
  });
  if (error) throw error;
  return data;
}

export async function newSite(client: Client, orgId: string, userId: string, domain: string) {
  const { data, error } = await client
    .from("sites")
    .insert({ org_id: orgId, name: domain, domain, cms_type: "wordpress", created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
