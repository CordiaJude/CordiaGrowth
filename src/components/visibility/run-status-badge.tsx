import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  running: "secondary",
  completed: "default",
  partial: "secondary",
  failed: "destructive",
  budget_blocked: "destructive",
};

const LABEL: Record<string, string> = { budget_blocked: "over budget" };

export function RunStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={VARIANT[status] ?? "outline"} data-testid="run-status">
      {(status === "queued" || status === "running") && <Loader2Icon className="animate-spin" />}
      {LABEL[status] ?? status}
    </Badge>
  );
}
