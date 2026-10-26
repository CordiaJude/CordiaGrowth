"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { addPrompts, type ActionState } from "@/lib/actions/visibility";

export function AddPromptsForm({ orgSlug, siteId }: { orgSlug: string; siteId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addPrompts.bind(null, orgSlug, siteId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.ok);
      ref.current?.reset();
    }
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <FormError message={state.error} />
      <Label htmlFor="prompts" className="sr-only">
        Prompts
      </Label>
      <Textarea
        id="prompts"
        name="prompts"
        rows={4}
        placeholder={"best emergency plumber in Austin\nwho installs tankless water heaters near me"}
      />
      <div>
        <SubmitButton pendingText="Adding…">Add prompts</SubmitButton>
      </div>
    </form>
  );
}
