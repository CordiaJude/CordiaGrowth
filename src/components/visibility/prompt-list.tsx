"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { deletePrompts, setPromptStatus, type ActionState } from "@/lib/actions/visibility";
import { formatPct, type RateSummary } from "@/lib/visibility/stats";

export type PromptRow = {
  id: string;
  text: string;
  status: "active" | "paused" | "suggested";
  source: "manual" | "suggested";
  rationale: string | null;
  rate: RateSummary;
};

export function PromptList({
  orgSlug,
  siteId,
  rows,
  mode,
  canEdit,
}: {
  orgSlug: string;
  siteId: string;
  rows: PromptRow[];
  mode: "suggested" | "tracked";
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));
  const allSelected = ids.length === rows.length && rows.length > 0;

  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.ok);
        setSelected(new Set());
      }
      router.refresh();
    });

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  return (
    <div className="flex flex-col gap-3" data-testid={`prompt-list-${mode}`}>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
              aria-label="Select all"
            />
            {ids.length ? `${ids.length} selected` : "Select all"}
          </label>
          {mode === "suggested" ? (
            <>
              <Button
                size="sm"
                disabled={!ids.length || pending}
                onClick={() => run(() => setPromptStatus(orgSlug, siteId, ids, "active"))}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ids.length || pending}
                onClick={() => run(() => deletePrompts(orgSlug, siteId, ids))}
              >
                Dismiss
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={!ids.length || pending}
                onClick={() => run(() => setPromptStatus(orgSlug, siteId, ids, "paused"))}
              >
                Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ids.length || pending}
                onClick={() => run(() => setPromptStatus(orgSlug, siteId, ids, "active"))}
              >
                Resume
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ids.length || pending}
                onClick={() => {
                  if (confirm(`Delete ${ids.length} prompt(s) and their results?`))
                    run(() => deletePrompts(orgSlug, siteId, ids));
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      )}
      <ul className="divide-y rounded-md border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-3 text-sm">
            {canEdit && (
              <Checkbox
                className="mt-0.5"
                checked={selected.has(r.id)}
                onCheckedChange={(v) => toggle(r.id, Boolean(v))}
                aria-label={`Select "${r.text}"`}
              />
            )}
            <div className="flex flex-1 flex-col gap-1">
              <span>{r.text}</span>
              {mode === "suggested" && r.rationale && (
                <span className="text-muted-foreground text-xs">{r.rationale}</span>
              )}
            </div>
            {mode === "tracked" && (
              <div className="flex shrink-0 items-center gap-2">
                {r.status === "paused" && <Badge variant="outline">paused</Badge>}
                <span
                  className="text-muted-foreground text-xs tabular-nums"
                  title="Share of sampled answers that mention you (95% range)"
                >
                  {r.rate.samples
                    ? `${formatPct(r.rate.rate)} (n = ${r.rate.samples}, ${formatPct(r.rate.low)}–${formatPct(r.rate.high)})`
                    : "not run yet"}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
