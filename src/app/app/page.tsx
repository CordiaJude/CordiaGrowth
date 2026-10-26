import { redirect } from "next/navigation";
import { listMyOrgs } from "@/lib/data/orgs";

/** Entry point after sign-in: first org, or onboarding when there is none. */
export default async function AppEntry() {
  const orgs = await listMyOrgs();
  redirect(orgs.length ? `/o/${orgs[0].slug}` : "/onboarding");
}
