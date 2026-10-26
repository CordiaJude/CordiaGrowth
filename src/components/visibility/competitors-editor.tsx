"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { addCompetitor, deleteCompetitor, type ActionState } from "@/lib/actions/visibility";

type Competitor = { id: string; name: string; domain: string | null; aliases: string[] };

export function CompetitorsEditor({
  orgSlug,
  siteId,
  canEdit,
  competitors,
}: {
  orgSlug: string;
  siteId: string;
  canEdit: boolean;
  competitors: Competitor[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(
    addCompetitor.bind(null, orgSlug, siteId),
    {},
  );
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.ok);
      ref.current?.reset();
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      {competitors.length ? (
        <ul className="divide-y rounded-md border">
          {competitors.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[c.domain, c.aliases.length ? `also: ${c.aliases.join(", ")}` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </div>
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${c.name}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await deleteCompetitor(orgSlug, siteId, c.id);
                      if (res.error) toast.error(res.error);
                      router.refresh();
                    })
                  }
                >
                  <XIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No competitors yet.</p>
      )}
      {canEdit && (
        <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <FormError message={state.error} />
          </div>
          <Input name="name" placeholder="Competitor name" aria-label="Competitor name" required />
          <Input name="domain" placeholder="competitor.com" aria-label="Competitor domain" />
          <Input
            name="aliases"
            placeholder="Other names (comma-separated)"
            aria-label="Competitor's other names"
          />
          <div className="sm:col-span-3">
            <SubmitButton pendingText="Adding…">Add competitor</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
