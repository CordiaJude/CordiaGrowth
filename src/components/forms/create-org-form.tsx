"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { createOrganization, type CreateOrgState } from "@/lib/actions/orgs";

export function CreateOrgForm() {
  const [state, action] = useActionState<CreateOrgState, FormData>(createOrganization, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Cordia"
          required
          maxLength={100}
          defaultValue={state.name}
        />
        <p className="text-muted-foreground text-xs">
          Usually your company or agency name. You can add several sites to it.
        </p>
      </div>
      <SubmitButton pendingText="Creating…">Create organization</SubmitButton>
    </form>
  );
}
