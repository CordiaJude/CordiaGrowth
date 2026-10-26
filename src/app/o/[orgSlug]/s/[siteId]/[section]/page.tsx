import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgBySlug } from "@/lib/data/orgs";
import { getSite } from "@/lib/data/sites";
import { createClient } from "@/lib/supabase/server";
import { SITE_SECTIONS } from "@/lib/nav";

export default async function SiteSectionPage({ params }: PageProps<"/o/[orgSlug]/s/[siteId]/[section]">) {
  const { orgSlug, siteId, section: slug } = await params;
  const section = SITE_SECTIONS.find((s) => s.slug === slug && s.slug !== "");
  if (!section) notFound();
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);

  if (section.slug === "settings") return <SettingsView siteId={site.id} />;

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{section.title}</h1>
        {section.phase && <Badge variant="outline">Coming in Phase {section.phase}</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Not built yet</CardTitle>
          <CardDescription>{section.summary}</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}

async function SettingsView({ siteId }: { siteId: string }) {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("site_settings").select("*").eq("site_id", siteId).single();
  if (!settings) notFound();

  const rows: [string, string, string][] = [
    [
      "Auto-publish",
      settings.auto_publish ? "On" : "Off",
      "Off by default. When off, nothing publishes without approval.",
    ],
    [
      "Monthly AI budget",
      `$${Number(settings.monthly_ai_budget_usd).toFixed(2)}`,
      "Hard cap on AI provider spend for this site.",
    ],
    ["AI visibility runs", settings.visibility_run_frequency, "How often tracked prompts are re-run."],
    [
      "Runs per prompt",
      String(settings.visibility_runs_per_prompt),
      "Each prompt is sampled this many times per run.",
    ],
    ["Content cadence", `${settings.content_pieces_per_week} per week`, "Quality over volume."],
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Site defaults</CardTitle>
          <CardDescription>Editing arrives with the features that use these settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(([label, value, hint]) => (
              <div key={label} className="grid grid-cols-3 gap-4 py-3 text-sm">
                <dt className="font-medium">{label}</dt>
                <dd className="capitalize" data-testid={`setting-${label}`}>
                  {value}
                </dd>
                <dd className="text-muted-foreground">{hint}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
