import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RangePicker } from "@/components/visibility/range-picker";
import { RunControls } from "@/components/visibility/run-controls";
import { TrendChart, type TrendPoint } from "@/components/visibility/trend-chart";
import { RunStatusBadge } from "@/components/visibility/run-status-badge";
import { aiConfig } from "@/config/ai";
import { getProvider } from "@/lib/ai/providers";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { getVisibilityData, resolveRange } from "@/lib/data/visibility";
import { formatPct, shareOfVoice, summarizeRate } from "@/lib/visibility/stats";

export const metadata: Metadata = { title: "AI visibility" };
// Inline (no Trigger.dev) runs started from this page execute after the response.
export const maxDuration = 300;

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function VisibilityPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/s/[siteId]/visibility">) {
  const { orgSlug, siteId } = await params;
  const { range: rangeParam } = await searchParams;
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);
  const range = resolveRange(rangeParam);
  const data = await getVisibilityData(site.id, range.from, range.to);
  const base = `/o/${org.slug}/s/${site.id}/visibility`;

  const cfg = aiConfig();
  const enabled = data.settings.visibility_providers.map((id) => getProvider(id)).filter((p) => p != null);
  const configured = enabled.filter((p) => p.isConfigured());
  const missingKeys = enabled.filter((p) => !p.isConfigured()).map((p) => p.label);
  const activePrompts = data.prompts.filter((p) => p.status === "active");
  const samples = data.settings.visibility_runs_per_prompt;
  const estimate =
    activePrompts.length * samples * configured.reduce((s, p) => s + cfg.estimates.perAnswerUsd[p.id], 0);
  const runInProgress = data.runs.some((r) => r.status === "queued" || r.status === "running");

  // Per-provider totals over the range.
  const byProvider = new Map<
    string,
    { samples: number; brand: number; comp: number; first: string; last: string }
  >();
  for (const row of data.trend) {
    const cur = byProvider.get(row.provider) ?? {
      samples: 0,
      brand: 0,
      comp: 0,
      first: row.first_at,
      last: row.last_at,
    };
    cur.samples += Number(row.samples);
    cur.brand += Number(row.brand_mentions);
    cur.comp += Number(row.competitor_mentions);
    if (row.first_at < cur.first) cur.first = row.first_at;
    if (row.last_at > cur.last) cur.last = row.last_at;
    byProvider.set(row.provider, cur);
  }
  const totalSamples = [...byProvider.values()].reduce((s, v) => s + v.samples, 0);

  // Chart: weekly mention rate per provider, with sample sizes for the tooltip.
  const buckets = new Map<string, TrendPoint>();
  for (const row of data.trend) {
    const key = row.bucket;
    const point = buckets.get(key) ?? { bucket: key, label: fmtDate(key) };
    point[row.provider] = Number(row.brand_mentions) / Number(row.samples);
    point[`${row.provider}_n`] = Number(row.samples);
    buckets.set(key, point);
  }
  const chartData = [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  const chartProviders = [...byProvider.keys()].map((id) => ({ id, label: getProvider(id)?.label ?? id }));

  // Prompts where we're missing: per prompt, the providers that never mentioned us in the range.
  const promptText = new Map(data.prompts.map((p) => [p.id, p.text]));
  const sampled = new Set<string>();
  const gaps = new Map<string, { providers: { id: string; n: number }[]; competitors: Set<string> }>();
  for (const s of data.promptStats) {
    sampled.add(s.prompt_id);
    if (Number(s.samples) === 0 || Number(s.brand_mentions) > 0 || !promptText.has(s.prompt_id)) continue;
    const cur = gaps.get(s.prompt_id) ?? { providers: [], competitors: new Set<string>() };
    cur.providers.push({ id: s.provider, n: Number(s.samples) });
    for (const c of s.top_competitors ?? []) cur.competitors.add(c);
    gaps.set(s.prompt_id, cur);
  }
  const missing = [...gaps.entries()]
    .map(([id, v]) => ({ id, text: promptText.get(id)!, ...v }))
    .sort((a, b) => b.providers.length - a.providers.length || a.text.localeCompare(b.text));
  const neverRun = activePrompts.filter((p) => !sampled.has(p.id)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <RangePicker current={range.key} />
        <RunControls
          orgSlug={org.slug}
          siteId={site.id}
          canRun={hasRole(org.role, "editor")}
          disabledReason={
            runInProgress
              ? "A run is in progress."
              : !activePrompts.length
                ? "Add or accept at least one prompt first."
                : !configured.length
                  ? "No AI provider API keys are configured."
                  : null
          }
          summary={`${activePrompts.length} prompts × ${configured.length} providers × ${samples} samples · est. $${estimate.toFixed(2)}`}
          budget={{ spent: data.spentThisMonth, cap: Number(data.settings.monthly_ai_budget_usd) }}
          missingKeys={missingKeys}
          active={runInProgress}
        />
      </div>

      <p className="text-muted-foreground text-sm" data-testid="sample-note">
        {totalSamples > 0
          ? `Based on ${totalSamples} sampled answers collected ${fmtDate(range.from)} – ${fmtDate(range.to)}. AI answers vary between runs, so each rate shows a 95% confidence range.`
          : "No answers collected in this period yet. Add prompts and start a run."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(chartProviders.length ? chartProviders : configured.map((p) => ({ id: p.id, label: p.label }))).map(
          (p) => {
            const v = byProvider.get(p.id);
            const rate = summarizeRate(v?.brand ?? 0, v?.samples ?? 0);
            const sov = v ? shareOfVoice(v.brand, v.comp) : null;
            return (
              <Card key={p.id} data-testid={`provider-card-${p.id}`}>
                <CardHeader>
                  <CardDescription>{p.label}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{formatPct(rate.rate)}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground flex flex-col gap-1 text-xs">
                  <span>of answers mention {data.brand.brand_name}</span>
                  <span className="tabular-nums">
                    {rate.samples > 0
                      ? `n = ${rate.samples} · 95% range ${formatPct(rate.low)}–${formatPct(rate.high)}`
                      : "no samples yet"}
                  </span>
                  <span className="tabular-nums">Share of voice vs. competitors: {formatPct(sov)}</span>
                  {v && <span>{`${fmtDate(v.first)} – ${fmtDate(v.last)}`}</span>}
                  {p.id === "gemini" && <span>Model knowledge only (no Google Search grounding).</span>}
                </CardContent>
              </Card>
            );
          },
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mention rate by provider, weekly</CardTitle>
          <CardDescription>
            Share of sampled answers that mention your brand. Hover a point for its sample size.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <TrendChart data={chartData} providers={chartProviders} />
          ) : (
            <p className="text-muted-foreground text-sm">The chart appears after the first completed run.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prompts where you&apos;re missing</CardTitle>
            <CardDescription>
              Prompts where an assistant never mentioned you in this period.
              {neverRun ? ` ${neverRun} active prompt${neverRun === 1 ? " has" : "s have"} not run yet.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missing.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prompt</TableHead>
                    <TableHead>Never mentioned by</TableHead>
                    <TableHead>Mentioned instead</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missing.slice(0, 15).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="max-w-xs whitespace-normal">{m.text}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {m.providers
                          .map((p) => `${getProvider(p.id)?.label ?? p.id} (n = ${p.n})`)
                          .join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-48 whitespace-normal text-xs">
                        {[...m.competitors].slice(0, 3).join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                {sampled.size
                  ? "Every assistant mentioned you at least once for every sampled prompt."
                  : "No data yet."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most-cited domains</CardTitle>
            <CardDescription>
              Sources AI answers cited most. These become off-site targets in the Authority section.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.domains.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-right">Answers citing</TableHead>
                    <TableHead>Providers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.domains.map((d) => (
                    <TableRow key={d.domain}>
                      <TableCell>
                        {d.domain}
                        {data.brand.own_domains.some((o) => d.domain === o || d.domain.endsWith(`.${o}`)) && (
                          <Badge variant="secondary" className="ml-2">
                            you
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(d.answers)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {d.providers.map((p) => getProvider(p)?.label ?? p).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">No citations collected yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {data.runs.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Answers</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link className="underline-offset-4 hover:underline" href={`${base}/runs/${r.id}`}>
                        {new Date(r.created_at).toLocaleString()}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="capitalize">{r.trigger}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.completed_calls}/{r.planned_calls}
                      {r.failed_calls ? ` (${r.failed_calls} failed)` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${Number(r.cost_usd).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
