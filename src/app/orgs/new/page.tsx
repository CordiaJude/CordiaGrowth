import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrgForm } from "@/components/forms/create-org-form";

export const metadata: Metadata = { title: "New organization" };

export default function NewOrgPage() {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">New organization</CardTitle>
          <CardDescription>Organizations keep sites, members and billing separate.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </main>
  );
}
