import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { requireUser } from "@/lib/data/auth";
import { getOrgBySlug, listMyOrgs } from "@/lib/data/orgs";
import { listSites } from "@/lib/data/sites";

export default async function OrgLayout({ children, params }: LayoutProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const user = await requireUser();
  const [orgs, org] = await Promise.all([listMyOrgs(), getOrgBySlug(orgSlug)]);
  const sites = await listSites(org.id);

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        orgs={orgs}
        org={org}
        sites={sites.map((s) => ({ id: s.id, name: s.name, domain: s.domain }))}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-muted-foreground text-sm">{org.name}</span>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
