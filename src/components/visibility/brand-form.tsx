"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { updateBrandProfile, type ActionState } from "@/lib/actions/visibility";

export function BrandForm({
  orgSlug,
  siteId,
  canEdit,
  brand,
}: {
  orgSlug: string;
  siteId: string;
  canEdit: boolean;
  brand: { name: string; aliases: string[]; domains: string[] };
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateBrandProfile.bind(null, orgSlug, siteId),
    {},
  );
  useEffect(() => {
    if (state.ok) toast.success(state.ok);
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="brand_name">Brand name</Label>
        <Input id="brand_name" name="brand_name" defaultValue={brand.name} disabled={!canEdit} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="aliases">Other names</Label>
        <Input
          id="aliases"
          name="aliases"
          defaultValue={brand.aliases.join(", ")}
          disabled={!canEdit}
          placeholder="Acme, Acme Plumbing Co"
        />
        <p className="text-muted-foreground text-xs">
          Comma-separated: abbreviations, former names, common spellings.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="own_domains">Your domains</Label>
        <Input
          id="own_domains"
          name="own_domains"
          defaultValue={brand.domains.join(", ")}
          disabled={!canEdit}
        />
      </div>
      {canEdit && (
        <div>
          <SubmitButton pendingText="Saving…">Save brand</SubmitButton>
        </div>
      )}
    </form>
  );
}
