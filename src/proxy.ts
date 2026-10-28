import type { NextRequest } from "next/server";
import { missingConfig, setupRequiredHtml } from "@/lib/config-status";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Without Supabase settings every route would 500; explain what's missing instead.
  const missing = missingConfig();
  if (missing.length) {
    return new Response(setupRequiredHtml(missing), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and API routes (which authenticate themselves).
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
