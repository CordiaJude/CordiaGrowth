import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrgForm } from "@/components/forms/create-org-form";

export const metadata: Metadata = { title: "Create your organization" };

export default function OnboardingPage() {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Create your organization</CardTitle>
          <CardDescription>Step 1 of 2. Next you&apos;ll add your first site.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </main>
  );
}
