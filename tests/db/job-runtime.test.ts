import { beforeAll, describe, expect, it } from "vitest";
import { executeJobRun } from "@/jobs/runtime";
import { admin, newOrg, newSite, newUser } from "./helpers";

let ctx: { orgId: string; siteId: string; userId: string };

beforeAll(async () => {
  const u = await newUser("jobs");
  const org = await newOrg(u.client, "Jobs Org");
  const site = await newSite(u.client, org.id, u.id, "jobs-example.com");
  ctx = { orgId: org.id, siteId: site.id, userId: u.id };
});

async function queued() {
  const { data, error } = await admin()
    .from("job_runs")
    .insert({
      org_id: ctx.orgId,
      site_id: ctx.siteId,
      task_id: "test",
      runner: "inline",
      triggered_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("executeJobRun", () => {
  it("records success, output and logs", async () => {
    const id = await queued();
    const res = await executeJobRun(id, async ({ log, siteId }) => {
      await log("step one");
      return { siteId, answer: 42 };
    });
    expect(res.ok).toBe(true);
    const { data } = await admin().from("job_runs").select("*").eq("id", id).single();
    expect(data?.status).toBe("succeeded");
    expect(data?.output).toEqual({ siteId: ctx.siteId, answer: 42 });
    expect(data?.logs).toEqual([expect.objectContaining({ level: "info", message: "step one" })]);
    expect(data?.started_at).not.toBeNull();
    expect(data?.finished_at).not.toBeNull();
  });

  it("records failures without throwing", async () => {
    const id = await queued();
    const res = await executeJobRun(id, async () => {
      throw new Error("boom");
    });
    expect(res).toEqual({ ok: false, error: "boom" });
    const { data } = await admin().from("job_runs").select("status, error").eq("id", id).single();
    expect(data).toEqual({ status: "failed", error: "boom" });
  });

  it("will not re-run a finished job", async () => {
    const id = await queued();
    await executeJobRun(id, async () => ({}));
    const res = await executeJobRun(id, async () => ({ again: true }));
    expect(res.ok).toBe(false);
  });

  it("the healthcheck refuses private targets even if one sneaks into the DB", async () => {
    const { siteHealthcheck } = await import("@/jobs/site-healthcheck");
    const { data: site } = await admin()
      .from("sites")
      .insert({ org_id: ctx.orgId, name: "evil", domain: "localtest.me", created_by: ctx.userId })
      .select("id")
      .single();
    const { data: run } = await admin()
      .from("job_runs")
      .insert({ org_id: ctx.orgId, site_id: site!.id, task_id: "site-healthcheck", runner: "inline" })
      .select("id")
      .single();
    const res = await executeJobRun(run!.id, siteHealthcheck);
    expect(res.ok).toBe(false);
  });
});
