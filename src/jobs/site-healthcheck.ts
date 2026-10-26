import { createAdminClient } from "../lib/supabase/admin";
import { safeFetch } from "../lib/net/safe-fetch";
import type { JobHandler } from "./runtime";

export const SITE_HEALTHCHECK = "site-healthcheck";

/** Pulls the <title> text out of an HTML document, if present. */
export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const text = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 300) : null;
}

/**
 * Phase 0 test job: fetches the site's homepage and robots.txt and records
 * basic reachability facts. Proves the queue, worker and job_runs wiring.
 */
export const siteHealthcheck: JobHandler = async ({ siteId, log }) => {
  if (!siteId) throw new Error("site-healthcheck requires a site");
  const db = createAdminClient();
  const { data: site, error } = await db.from("sites").select("domain").eq("id", siteId).single();
  if (error || !site) throw new Error("Site not found");

  const homepage = `https://${site.domain}/`;
  await log(`Fetching ${homepage}`);
  const page = await safeFetch(homepage, { maxBytes: 3 * 1024 * 1024 });
  for (const r of page.redirects) await log(`Redirect ${r.status} from ${r.url}`);
  await log(`Got HTTP ${page.status} from ${page.url} in ${page.elapsedMs} ms (${page.bytes} bytes)`);

  let robots: { status: number; found: boolean; bytes: number } | { error: string };
  try {
    const robotsUrl = new URL("/robots.txt", page.url).toString();
    await log(`Fetching ${robotsUrl}`);
    const r = await safeFetch(robotsUrl, { maxBytes: 512 * 1024 });
    robots = { status: r.status, found: r.status === 200, bytes: r.bytes };
    await log(`robots.txt: HTTP ${r.status}`);
  } catch (e) {
    robots = { error: e instanceof Error ? e.message : String(e) };
    await log(`robots.txt fetch failed: ${robots.error}`, "warn");
  }

  return {
    requested_url: homepage,
    final_url: page.url,
    status: page.status,
    ok: page.status >= 200 && page.status < 300,
    redirects: page.redirects,
    response_ms: page.elapsedMs,
    bytes: page.bytes,
    truncated: page.truncated,
    content_type: page.headers.get("content-type"),
    title: extractTitle(page.body),
    robots_txt: robots,
    checked_at: new Date().toISOString(),
  };
};
