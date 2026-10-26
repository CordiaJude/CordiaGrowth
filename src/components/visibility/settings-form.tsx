"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { updateVisibilitySettings, type ActionState } from "@/lib/actions/visibility";

export function VisibilitySettingsForm({
  orgSlug,
  siteId,
  canEdit,
  providers,
  settings,
}: {
  orgSlug: string;
  siteId: string;
  canEdit: boolean;
  providers: { id: string; label: string; model: string; configured: boolean }[];
  settings: { providers: string[]; frequency: string; samples: number; budget: number };
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateVisibilitySettings.bind(null, orgSlug, siteId),
    {},
  );
  useEffect(() => {
    if (state.ok) toast.success(state.ok);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError message={state.error} />
      <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
        <legend className="mb-2 text-sm font-medium">Assistants</legend>
        {providers.map((p) => (
          <label key={p.id} className="flex items-start gap-3 text-sm">
            <Checkbox
              name="providers"
              value={p.id}
              defaultChecked={settings.providers.includes(p.id)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span>
                {p.label} <span className="text-muted-foreground text-xs">({p.model})</span>
              </span>
              <span className="text-muted-foreground text-xs">
                {!p.configured
                  ? "API key not configured; skipped until it is."
                  : p.id === "gemini"
                    ? "Answers from model knowledge; Google's terms don't allow storing search-grounded answers."
                    : "Answers with live web search."}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="frequency">Run frequency</Label>
          <Select name="frequency" defaultValue={settings.frequency} disabled={!canEdit}>
            <SelectTrigger id="frequency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="samples">Samples per prompt</Label>
          <Input
            id="samples"
            name="samples"
            type="number"
            min={1}
            max={10}
            defaultValue={settings.samples}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="budget">Monthly budget (USD)</Label>
          <Input
            id="budget"
            name="budget"
            type="number"
            min={0}
            step="1"
            defaultValue={settings.budget}
            disabled={!canEdit}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Each prompt is asked several times per run because AI answers vary. Runs stop when the monthly budget
        is reached; a run that wouldn&apos;t fit in the remaining budget doesn&apos;t start.
      </p>
      {canEdit && (
        <div>
          <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
        </div>
      )}
    </form>
  );
}
