"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { createSite, type CreateSiteState } from "@/lib/actions/sites";
import { CMS_TYPES } from "@/lib/constants";

export function CreateSiteForm({ orgSlug }: { orgSlug: string }) {
  const [state, action] = useActionState<CreateSiteState, FormData>(createSite.bind(null, orgSlug), {});
  const f = state.fields ?? {};

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError message={state.error} />
      </div>
      <Field label="Site name" name="name" placeholder="Cordia Plumbing" defaultValue={f.name} required />
      <Field
        label="Domain"
        name="domain"
        placeholder="example.com"
        defaultValue={f.domain}
        required
        hint="We'll store the bare domain, without https:// or www."
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="cms_type">CMS</Label>
        <Select name="cms_type" defaultValue={f.cms_type || "wordpress"}>
          <SelectTrigger id="cms_type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CMS_TYPES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field
        label="Business type"
        name="business_type"
        placeholder="Plumber, dentist, SaaS…"
        defaultValue={f.business_type}
      />
      <Field label="City" name="city" placeholder="Austin" defaultValue={f.city} />
      <Field label="State / region" name="region" placeholder="TX" defaultValue={f.region} />
      <Field label="Country code" name="country" placeholder="US" defaultValue={f.country} maxLength={2} />
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding site…">Add site</SubmitButton>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  ...props
}: { label: string; name: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
