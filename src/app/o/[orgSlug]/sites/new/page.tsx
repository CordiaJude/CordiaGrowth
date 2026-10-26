import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreateSiteForm } from "@/components/sites/create-site-form";
import { getOrgBySlug, hasRole } from "@/lib/data/orgs";

export const metadata: Metadata = { title: "Add site" };

export default async function NewSitePage({ params }: PageProps<"/o/[orgSlug]/sites/new">) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Add a site</CardTitle>
        <CardDescription>
          Business type and location shape the prompts we track and the schema we suggest later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasRole(org.role, "editor") ? (
          <CreateSiteForm orgSlug={org.slug} />
        ) : (
          <Alert>
            <AlertDescription>Viewers can&apos;t add sites. Ask an owner for editor access.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
