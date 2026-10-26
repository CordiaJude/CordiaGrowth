import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RunStatusBadge } from "@/components/visibility/run-status-badge";
import { AutoRefresh } from "@/components/visibility/auto-refresh";
import { getProvider } from "@/lib/ai/providers";
import { getOrgBySlug } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { getRunWithResults } from "@/lib/data/visibility";

export const metadata: Metadata = { title: "Visibility run" };

export default async function RunPage({
  params,
}: PageProps<"/o/[orgSlug]/s/[siteId]/visibility/runs/[runId]">) {
  const { orgSlug, siteId, runId } = await params;
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);
  if (!/^[0-9a-f-]{36}$/i.test(runId)) notFound();
  const { run, results, prompts } = await getRunWithResults(site.id, runId);
  if (!run) notFound();
  const active = run.status === "queued" || run.status === "running";

  const byPrompt = new Map<string, typeof results>();
  for (const r of results) byPrompt.set(r.prompt_id, [...(byPrompt.get(r.prompt_id) ?? []), r]);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={active} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Run of {new Date(run.created_at).toLocaleString()} <RunStatusBadge status={run.status} />
          </CardTitle>
          <CardDescription>
            {run.prompt_count} prompts × {run.providers.length} providers × {run.samples_per_prompt} samples ·{" "}
            {run.completed_calls}/{run.planned_calls} answers stored
            {run.failed_calls ? ` · ${run.failed_calls} failed` : ""} · cost $
            {Number(run.cost_usd).toFixed(2)} (estimated ${Number(run.estimated_cost_usd).toFixed(2)})
          </CardDescription>
        </CardHeader>
        {run.error && (
          <CardContent>
            <p className="text-destructive text-sm">{run.error}</p>
          </CardContent>
        )}
      </Card>

      {[...byPrompt.entries()].map(([promptId, rows]) => {
        const mentioned = rows.filter((r) => r.status === "ok" && r.brand_mentioned).length;
        const ok = rows.filter((r) => r.status === "ok").length;
        return (
          <Card key={promptId}>
            <CardHeader>
              <CardTitle className="text-base">{prompts.get(promptId) ?? "(deleted prompt)"}</CardTitle>
              <CardDescription>
                Mentioned in {mentioned} of {ok} answers in this run.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {rows.map((r) => (
                <details key={r.id} className="rounded-md border p-3 text-sm">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-medium">{getProvider(r.provider)?.label ?? r.provider}</span>
                    <span className="text-muted-foreground text-xs">
                      sample {r.sample_index + 1} · {r.model}
                    </span>
                    {r.status !== "ok" ? (
                      <Badge variant="destructive">{r.status}</Badge>
                    ) : r.brand_mentioned ? (
                      <Badge>
                        {r.brand_position
                          ? `mentioned #${r.brand_position} of ${r.listed_count}`
                          : "mentioned"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">not mentioned</Badge>
                    )}
                    {r.our_domain_cited && <Badge variant="secondary">your site cited</Badge>}
                    {r.competitors_mentioned.length > 0 && (
                      <span className="text-muted-foreground text-xs">
                        competitors: {r.competitors_mentioned.join(", ")}
                      </span>
                    )}
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    {r.error && <p className="text-destructive text-xs">{r.error}</p>}
                    {r.answer_text && (
                      <p className="bg-muted max-h-80 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
                        {r.answer_text}
                      </p>
                    )}
                    {r.cited_urls.length > 0 && (
                      <div className="text-xs">
                        <div className="mb-1 font-medium">Cited sources ({r.cited_urls.length})</div>
                        <ul className="list-disc pl-5">
                          {r.cited_urls.slice(0, 20).map((u) => (
                            <li key={u} className="break-all">
                              <a
                                href={u}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="underline-offset-2 hover:underline"
                              >
                                {u}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
