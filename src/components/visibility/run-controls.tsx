"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { runVisibilityNow } from "@/lib/actions/visibility";

export function RunControls({
  orgSlug,
  siteId,
  canRun,
  disabledReason,
  summary,
  budget,
  missingKeys,
  active,
}: {
  orgSlug: string;
  siteId: string;
  canRun: boolean;
  disabledReason: string | null;
  summary: string;
  budget: { spent: number; cap: number };
  missingKeys: string[];
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Refresh while a run is in progress so counts and status update.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [active, router]);

  const pct = budget.cap > 0 ? Math.min(100, (budget.spent / budget.cap) * 100) : 100;

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 text-sm">
      {canRun && (
        <div className="flex items-center gap-3">
          <Button
            data-testid="run-visibility"
            disabled={pending || Boolean(disabledReason)}
            onClick={() =>
              startTransition(async () => {
                const res = await runVisibilityNow(orgSlug, siteId);
                if (res.error) toast.error(res.error);
                else toast.success(res.ok);
                router.refresh();
              })
            }
          >
            {pending || active ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
            {active ? "Running…" : "Run now"}
          </Button>
          <span className="text-muted-foreground text-xs">{disabledReason ?? summary}</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
          <span>AI spend this month</span>
          <span>
            ${budget.spent.toFixed(2)} of ${budget.cap.toFixed(2)}
          </span>
        </div>
        <Progress value={pct} aria-label="Monthly AI budget used" />
      </div>
      {missingKeys.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Skipped (no API key configured): {missingKeys.join(", ")}.
        </p>
      )}
    </div>
  );
}
