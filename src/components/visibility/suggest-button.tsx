"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestPrompts } from "@/lib/actions/visibility";

export function SuggestButton({
  orgSlug,
  siteId,
  job,
}: {
  orgSlug: string;
  siteId: string;
  job: { status: string; error: string | null } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const running = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [running, router]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
      <Button
        variant="outline"
        disabled={pending || running}
        data-testid="suggest-prompts"
        onClick={() =>
          startTransition(async () => {
            const res = await suggestPrompts(orgSlug, siteId);
            if (res.error) toast.error(res.error);
            else toast.success(res.ok);
            router.refresh();
          })
        }
      >
        {pending || running ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
        {running ? "Suggesting…" : "Suggest 20 starter prompts"}
      </Button>
      <span className="text-muted-foreground text-xs">
        {job?.status === "failed"
          ? `Last attempt failed: ${job.error}`
          : "Uses your homepage and business details. Costs a few cents."}
      </span>
    </div>
  );
}
