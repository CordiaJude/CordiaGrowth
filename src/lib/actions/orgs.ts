"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

export type CreateOrgState = { error?: string; name?: string };

const schema = z.object({ name: z.string().trim().min(1, "Enter a name").max(100) });

export async function createOrganization(_prev: CreateOrgState, formData: FormData): Promise<CreateOrgState> {
  await requireUser();
  const parsed = schema.safeParse({ name: formData.get("name") });
  const name = String(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, name };

  const supabase = await createClient();
  const base = slugify(parsed.data.name) || "org";

  // Slugs are global; on a collision append a short random suffix.
  let slug = base;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: parsed.data.name,
      p_slug: slug,
    });
    if (!error && data) redirect(`/o/${data.slug}/sites/new`);
    if (error?.code !== "23505") {
      return { error: error?.message ?? "Could not create the organization.", name };
    }
    slug = `${base.slice(0, 41)}-${randomBytes(3).toString("hex")}`;
  }
  return { error: "Could not find a free URL for this name. Try a different name.", name };
}
