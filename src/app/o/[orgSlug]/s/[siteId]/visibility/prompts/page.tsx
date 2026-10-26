import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddPromptsForm } from "@/components/visibility/add-prompts-form";
import { PromptList, type PromptRow } from "@/components/visibility/prompt-list";
import { SuggestButton } from "@/components/visibility/suggest-button";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { getVisibilityData, resolveRange } from "@/lib/data/visibility";
import { createClient } from "@/lib/supabase/server";
import { summarizeRate } from "@/lib/visibility/stats";
import { VISIBILITY_SUGGEST } from "@/jobs/visibility-suggest";

export const metadata: Metadata = { title: "Tracked prompts" };
export const maxDuration = 300;

export default async function PromptsPage({
  params,
}: PageProps<"/o/[orgSlug]/s/[siteId]/visibility/prompts">) {
  const { orgSlug, siteId } = await params;
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);
  const range = resolveRange("90d");
  const data = await getVisibilityData(site.id, range.from, range.to);
  const canEdit = hasRole(org.role, "editor");

  const supabase = await createClient();
  const { data: lastSuggest } = await supabase
    .from("job_runs")
    .select("id, status, error, created_at")
    .eq("site_id", site.id)
    .eq("task_id", VISIBILITY_SUGGEST)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stats = new Map<string, { samples: number; mentions: number }>();
  for (const s of data.promptStats) {
    const cur = stats.get(s.prompt_id) ?? { samples: 0, mentions: 0 };
    cur.samples += Number(s.samples);
    cur.mentions += Number(s.brand_mentions);
    stats.set(s.prompt_id, cur);
  }
  const rows: PromptRow[] = data.prompts.map((p) => {
    const st = stats.get(p.id);
    const rate = summarizeRate(st?.mentions ?? 0, st?.samples ?? 0);
    return { id: p.id, text: p.text, status: p.status, source: p.source, rationale: p.rationale, rate };
  });
  const suggested = rows.filter((r) => r.status === "suggested");
  const tracked = rows.filter((r) => r.status !== "suggested");

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Add prompts</CardTitle>
            <CardDescription>
              Questions your customers might ask an AI assistant, one per line. For example: &quot;best{" "}
              {site.business_type?.toLowerCase() || "plumber"} in {site.city || "Austin"}&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AddPromptsForm orgSlug={org.slug} siteId={site.id} />
            <SuggestButton
              orgSlug={org.slug}
              siteId={site.id}
              job={lastSuggest ? { status: lastSuggest.status, error: lastSuggest.error } : null}
            />
          </CardContent>
        </Card>
      )}

      {suggested.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested prompts ({suggested.length})</CardTitle>
            <CardDescription>
              Generated from your homepage and business info. Nothing is tracked until you accept it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PromptList
              orgSlug={org.slug}
              siteId={site.id}
              rows={suggested}
              mode="suggested"
              canEdit={canEdit}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Tracked prompts ({tracked.filter((r) => r.status === "active").length} active)
          </CardTitle>
          <CardDescription>Mention rates cover the last 90 days, with sample size (n).</CardDescription>
        </CardHeader>
        <CardContent>
          {tracked.length ? (
            <PromptList orgSlug={org.slug} siteId={site.id} rows={tracked} mode="tracked" canEdit={canEdit} />
          ) : (
            <p className="text-muted-foreground text-sm">No prompts yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
