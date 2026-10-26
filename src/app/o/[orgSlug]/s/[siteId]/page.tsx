import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobRunsPanel } from "@/components/sites/job-runs-panel";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { getSite, listRecentJobRuns } from "@/lib/data/sites";
import { cmsLabel } from "@/lib/constants";

export default async function SiteOverview({ params }: PageProps<"/o/[orgSlug]/s/[siteId]">) {
  const { orgSlug, siteId } = await params;
  const org = await getOrgBySlug(orgSlug);
  const site = await getSite(org.id, siteId);
  const runs = await listRecentJobRuns(site.id);
  const location = [site.city, site.region, site.country].filter(Boolean).join(", ");

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
        <p className="text-muted-foreground text-sm">
          <a
            className="underline-offset-4 hover:underline"
            href={`https://${site.domain}`}
            target="_blank"
            rel="noreferrer"
          >
            {site.domain}
          </a>
          {" · "}
          {cmsLabel(site.cms_type)}
          {site.business_type ? ` · ${site.business_type}` : ""}
          {location ? ` · ${location}` : ""}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Background jobs</CardTitle>
          <CardDescription>
            The site health check fetches the homepage and robots.txt. It&apos;s the Phase 0 test job that
            proves the job queue works.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobRunsPanel
            orgSlug={org.slug}
            siteId={site.id}
            canRun={hasRole(org.role, "editor")}
            runs={runs.map((r) => ({
              id: r.id,
              task_id: r.task_id,
              status: r.status,
              runner: r.runner,
              created_at: r.created_at,
              started_at: r.started_at,
              finished_at: r.finished_at,
              error: r.error,
              output: r.output,
              logs: r.logs,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
