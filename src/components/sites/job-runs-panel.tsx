"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runHealthcheck } from "@/lib/actions/sites";
import type { Json } from "@/lib/supabase/database.types";

type Run = {
  id: string;
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  runner: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  output: Json | null;
  logs: Json;
};

const STATUS_VARIANT: Record<Run["status"], "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  running: "secondary",
  succeeded: "default",
  failed: "destructive",
  canceled: "outline",
};

export function JobRunsPanel({
  orgSlug,
  siteId,
  canRun,
  runs,
}: {
  orgSlug: string;
  siteId: string;
  canRun: boolean;
  runs: Run[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // undefined = follow the newest run; otherwise whatever the user picked.
  const [picked, setExpanded] = useState<string | null | undefined>(undefined);
  const expanded = picked === undefined ? (runs[0]?.id ?? null) : picked;
  const active = runs.some((r) => r.status === "queued" || r.status === "running");

  // Poll while a job is in flight so status and logs update live.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(t);
  }, [active, router]);

  function run() {
    setExpanded(undefined);
    startTransition(async () => {
      const res = await runHealthcheck(orgSlug, siteId);
      if (res.error) toast.error(res.error);
      else toast.success("Health check queued");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canRun && (
        <div>
          <Button onClick={run} disabled={pending} data-testid="run-test-job">
            {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
            Run test job
          </Button>
        </div>
      )}
      {runs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No jobs have run for this site yet.</p>
      ) : (
        <ul className="divide-y rounded-md border" data-testid="job-runs">
          {runs.map((r) => (
            <li key={r.id} className="p-3">
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left text-sm"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                aria-expanded={expanded === r.id}
              >
                <Badge variant={STATUS_VARIANT[r.status]} data-testid="job-status">
                  {(r.status === "running" || r.status === "queued") && (
                    <Loader2Icon className="animate-spin" />
                  )}
                  {r.status}
                </Badge>
                <span className="font-medium">{r.task_id}</span>
                <span className="text-muted-foreground">via {r.runner}</span>
                <span className="text-muted-foreground ml-auto tabular-nums">
                  {new Date(r.created_at).toLocaleString()}
                  {r.started_at && r.finished_at
                    ? ` · ${((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000).toFixed(1)}s`
                    : ""}
                </span>
              </button>
              {expanded === r.id && <RunDetails run={r} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunDetails({ run }: { run: Run }) {
  const logs = Array.isArray(run.logs) ? (run.logs as { at: string; level: string; message: string }[]) : [];
  return (
    <div className="mt-3 flex flex-col gap-3 text-sm">
      {run.error && <p className="text-destructive">{run.error}</p>}
      {logs.length > 0 && (
        <ol className="bg-muted rounded-md p-3 font-mono text-xs">
          {logs.map((l, i) => (
            <li
              key={i}
              className={
                l.level === "error" ? "text-destructive" : l.level === "warn" ? "text-amber-600" : ""
              }
            >
              <span className="text-muted-foreground">{new Date(l.at).toLocaleTimeString()}</span> {l.message}
            </li>
          ))}
        </ol>
      )}
      {run.output != null && (
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs" data-testid="job-output">
          {JSON.stringify(run.output, null, 2)}
        </pre>
      )}
    </div>
  );
}
