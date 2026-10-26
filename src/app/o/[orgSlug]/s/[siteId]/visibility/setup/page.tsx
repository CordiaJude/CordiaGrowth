import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandForm } from "@/components/visibility/brand-form";
import { CompetitorsEditor } from "@/components/visibility/competitors-editor";
import { VisibilitySettingsForm } from "@/components/visibility/settings-form";
import { allProviders } from "@/lib/ai/providers";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { getUsageLog, getVisibilityData, resolveRange } from "@/lib/data/visibility";

export const metadata: Metadata = { title: "Visibility setup" };

export default async function SetupPage({ params }: PageProps<"/o/[orgSlug]/s/[siteId]/visibility/setup">) {
  const { orgSlug, siteId } = await params;
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);
  const range = resolveRange("30d");
  const [data, usage] = await Promise.all([
    getVisibilityData(site.id, range.from, range.to),
    getUsageLog(site.id),
  ]);
  const canEdit = hasRole(org.role, "editor");
  const providers = allProviders().map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    configured: p.isConfigured(),
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Brand</CardTitle>
          <CardDescription>Names and domains that count as a mention of this business.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandForm
            orgSlug={org.slug}
            siteId={site.id}
            canEdit={canEdit}
            brand={{
              name: data.brand.brand_name,
              aliases: data.brand.aliases,
              domains: data.brand.own_domains,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competitors</CardTitle>
          <CardDescription>
            Used for share of voice and to show who gets recommended instead of you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompetitorsEditor
            orgSlug={org.slug}
            siteId={site.id}
            canEdit={canEdit}
            competitors={data.competitors.map((c) => ({
              id: c.id,
              name: c.name,
              domain: c.domain,
              aliases: c.aliases,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs and budget</CardTitle>
          <CardDescription>
            Which assistants to ask, how often, and the monthly spending cap for this site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VisibilitySettingsForm
            orgSlug={org.slug}
            siteId={site.id}
            canEdit={canEdit}
            providers={providers}
            settings={{
              providers: data.settings.visibility_providers,
              frequency: data.settings.visibility_run_frequency,
              samples: data.settings.visibility_runs_per_prompt,
              budget: Number(data.settings.monthly_ai_budget_usd),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage log</CardTitle>
          <CardDescription>
            Every paid AI call for this site. ${data.spentThisMonth.toFixed(2)} spent this month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.length ? (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Tokens in/out</TableHead>
                    <TableHead className="text-right">Searches</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-xs">{new Date(u.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{u.model}</TableCell>
                      <TableCell className="text-xs">{u.purpose.replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {u.input_tokens.toLocaleString()}/{u.output_tokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{u.search_requests}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        ${Number(u.cost_usd).toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No AI calls yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
