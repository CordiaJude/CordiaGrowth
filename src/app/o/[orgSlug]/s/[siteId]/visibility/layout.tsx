import { VisibilityNav } from "@/components/visibility/visibility-nav";

export default async function VisibilityLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]/s/[siteId]/visibility">) {
  const { orgSlug, siteId } = await params;
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">AI visibility</h1>
        <VisibilityNav base={`/o/${orgSlug}/s/${siteId}/visibility`} />
      </div>
      {children}
    </>
  );
}
