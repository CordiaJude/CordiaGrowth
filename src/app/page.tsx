import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/data/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">CordiaGrowth</h1>
      <p className="text-muted-foreground max-w-md">
        Track how often AI assistants mention your business, fix what holds your site back, and publish
        content worth citing.
      </p>
      <div className="flex gap-3">
        {user ? (
          <Button asChild>
            <Link href="/app">Open dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
