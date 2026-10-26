import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrgBySlug } from "@/lib/data/orgs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/o/[orgSlug]/members">) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("memberships")
    .select("role, created_at, user_id")
    .eq("org_id", org.id)
    .order("created_at");
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
      <Card>
        <CardHeader>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>
            Owners manage members and billing, editors manage sites and content, viewers have read-only
            access. Invitations arrive in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((m) => {
                const p = byId.get(m.user_id);
                return (
                  <TableRow key={m.user_id}>
                    <TableCell>{p?.full_name || "—"}</TableCell>
                    <TableCell>{p?.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
