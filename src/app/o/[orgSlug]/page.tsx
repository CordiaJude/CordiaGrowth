import Link from "next/link";
import { GlobeIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";
import { listSites } from "@/lib/data/sites";
import { cmsLabel } from "@/lib/constants";

export default async function OrgHome({ params }: PageProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  const sites = await listSites(org.id);
  const canEdit = hasRole(org.role, "editor");

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-muted-foreground text-sm">Every site in {org.name}.</p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href={`/o/${org.slug}/sites/new`}>
              <PlusIcon /> Add site
            </Link>
          </Button>
        )}
      </div>

      {sites.length === 0 ? (
        <Card className="items-center py-12 text-center">
          <GlobeIcon className="text-muted-foreground size-8" />
          <CardHeader className="w-full">
            <CardTitle>No sites yet</CardTitle>
            <CardDescription>
              {canEdit ? "Add your first site to start tracking it." : "An editor or owner can add sites."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link key={site.id} href={`/o/${org.slug}/s/${site.id}`} className="group">
              <Card className="group-hover:border-foreground/30 h-full transition-colors">
                <CardHeader>
                  <CardTitle>{site.name}</CardTitle>
                  <CardDescription>
                    {site.domain} · {cmsLabel(site.cms_type)}
                    {site.city ? ` · ${site.city}` : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
