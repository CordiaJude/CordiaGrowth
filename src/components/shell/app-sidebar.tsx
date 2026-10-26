"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  BuildingIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  LayoutGridIcon,
  LogOutIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/(auth)/actions";
import { SITE_SECTIONS } from "@/lib/nav";

type Org = { id: string; name: string; slug: string; role: string };
type SiteOption = { id: string; name: string; domain: string };

export function AppSidebar({
  user,
  orgs,
  org,
  sites,
}: {
  user: { email: string };
  orgs: Org[];
  org: Org;
  sites: SiteOption[];
}) {
  const params = useParams<{ siteId?: string }>();
  const pathname = usePathname();
  const site = sites.find((s) => s.id === params.siteId);
  const base = `/o/${org.slug}`;

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" aria-label="Switch organization">
                  <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
                    <BuildingIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{org.name}</span>
                    <span className="text-muted-foreground truncate text-xs capitalize">{org.role}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56" align="start">
                <DropdownMenuLabel className="text-muted-foreground text-xs">Organizations</DropdownMenuLabel>
                {orgs.map((o) => (
                  <DropdownMenuItem key={o.id} asChild>
                    <Link href={`/o/${o.slug}`}>
                      {o.name}
                      {o.id === org.id && <CheckIcon className="ml-auto" />}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/orgs/new">
                    <PlusIcon /> New organization
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton aria-label="Switch site" data-testid="site-switcher">
                  <GlobeIcon />
                  <span className="truncate">{site ? site.domain : "Select a site"}</span>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56" align="start">
                <DropdownMenuLabel className="text-muted-foreground text-xs">Sites</DropdownMenuLabel>
                {sites.length === 0 && <DropdownMenuItem disabled>No sites yet</DropdownMenuItem>}
                {sites.map((s) => (
                  <DropdownMenuItem key={s.id} asChild>
                    <Link href={`${base}/s/${s.id}`}>
                      <span className="truncate">{s.domain}</span>
                      {s.id === site?.id && <CheckIcon className="ml-auto" />}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`${base}/sites/new`}>
                    <PlusIcon /> Add site
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {site && (
          <SidebarGroup>
            <SidebarGroupLabel>{site.name}</SidebarGroupLabel>
            <SidebarMenu>
              {SITE_SECTIONS.map((section) => {
                const href = `${base}/s/${site.id}${section.slug ? `/${section.slug}` : ""}`;
                return (
                  <SidebarMenuItem key={section.slug || "overview"}>
                    <SidebarMenuButton
                      asChild
                      isActive={section.slug ? pathname.startsWith(href) : pathname === href}
                    >
                      <Link href={href}>
                        <section.icon />
                        <span>{section.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {section.phase && <SidebarMenuBadge>P{section.phase}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === base}>
                <Link href={base}>
                  <LayoutGridIcon />
                  <span>All sites</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `${base}/members`}>
                <Link href={`${base}/members`}>
                  <UsersIcon />
                  <span>Members</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit" className="text-muted-foreground">
                <LogOutIcon />
                <span className="truncate">Sign out {user.email}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
