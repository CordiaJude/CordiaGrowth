import { beforeAll, describe, expect, it } from "vitest";
import { admin, newOrg, newSite, newUser } from "./helpers";

type U = Awaited<ReturnType<typeof newUser>>;
let owner: U;
let viewer: U;
let outsider: U;
let orgId: string;
let siteId: string;

beforeAll(async () => {
  [owner, viewer, outsider] = await Promise.all([
    newUser("vowner"),
    newUser("vviewer"),
    newUser("voutsider"),
  ]);
  const org = await newOrg(owner.client, "Vis Org");
  orgId = org.id;
  siteId = (await newSite(owner.client, orgId, owner.id, "vis-example.com")).id;
  await owner.client.from("memberships").insert({ org_id: orgId, user_id: viewer.id, role: "viewer" });
  await newOrg(outsider.client, "Other Org");
});

describe("visibility tables", () => {
  it("each new site gets a brand profile seeded from the site", async () => {
    const { data } = await owner.client.from("brand_profiles").select("*").eq("site_id", siteId).single();
    expect(data).toMatchObject({
      brand_name: "vis-example.com",
      own_domains: ["vis-example.com"],
      aliases: [],
    });
  });

  it("editors add prompts; viewers and outsiders cannot", async () => {
    const add = await owner.client
      .from("visibility_prompts")
      .insert({ org_id: orgId, site_id: siteId, text: "best plumber in austin", created_by: owner.id })
      .select("status, source")
      .single();
    expect(add.data).toEqual({ status: "active", source: "manual" });

    const byViewer = await viewer.client
      .from("visibility_prompts")
      .insert({ org_id: orgId, site_id: siteId, text: "viewer prompt", created_by: viewer.id });
    expect(byViewer.error).not.toBeNull();

    const byOutsider = await outsider.client
      .from("visibility_prompts")
      .insert({ org_id: orgId, site_id: siteId, text: "outsider prompt", created_by: outsider.id });
    expect(byOutsider.error).not.toBeNull();
    expect(
      (await outsider.client.from("visibility_prompts").select("id").eq("site_id", siteId)).data,
    ).toHaveLength(0);
  });

  it("users cannot forge AI suggestions (source=suggested is server-only)", async () => {
    const { error } = await owner.client
      .from("visibility_prompts")
      .insert({ org_id: orgId, site_id: siteId, text: "forged", source: "suggested", created_by: owner.id });
    expect(error).not.toBeNull();
  });

  it("prompts are unique per site, case-insensitively", async () => {
    const { error } = await owner.client
      .from("visibility_prompts")
      .insert({ org_id: orgId, site_id: siteId, text: "BEST PLUMBER IN AUSTIN", created_by: owner.id });
    expect(error?.code).toBe("23505");
  });

  it("only the server writes results and usage; users can't insert them", async () => {
    const { data: run } = await owner.client
      .from("visibility_runs")
      .insert({ org_id: orgId, site_id: siteId, created_by: owner.id })
      .select("id, status")
      .single();
    expect(run?.status).toBe("queued");

    const { data: prompt } = await owner.client
      .from("visibility_prompts")
      .select("id")
      .eq("site_id", siteId)
      .limit(1)
      .single();
    const res = await owner.client.from("visibility_results").insert({
      org_id: orgId,
      site_id: siteId,
      run_id: run!.id,
      prompt_id: prompt!.id,
      provider: "openai",
      model: "m",
      sample_index: 0,
      status: "ok",
      brand_mentioned: true,
    });
    expect(res.error).not.toBeNull();
    const usage = await owner.client
      .from("llm_usage")
      .insert({ org_id: orgId, site_id: siteId, provider: "x", model: "m", purpose: "p" });
    expect(usage.error).not.toBeNull();
    const fakeComplete = await owner.client
      .from("visibility_runs")
      .update({ status: "completed" })
      .eq("id", run!.id);
    expect(fakeComplete.error).not.toBeNull();
    const scheduled = await owner.client
      .from("visibility_runs")
      .insert({ org_id: orgId, site_id: siteId, created_by: owner.id, trigger: "scheduled" });
    expect(scheduled.error).not.toBeNull();
  });

  it("budget and spend: settings are editor-only; spend respects RLS", async () => {
    await admin().from("llm_usage").insert({
      org_id: orgId,
      site_id: siteId,
      provider: "openai",
      model: "m",
      purpose: "test",
      cost_usd: 1.25,
    });
    const own = await owner.client.rpc("site_ai_spend_this_month", { p_site_id: siteId });
    expect(Number(own.data)).toBeCloseTo(1.25);
    const other = await outsider.client.rpc("site_ai_spend_this_month", { p_site_id: siteId });
    expect(Number(other.data)).toBe(0);

    const viewerEdit = await viewer.client
      .from("site_settings")
      .update({ monthly_ai_budget_usd: 9999 })
      .eq("site_id", siteId)
      .select();
    expect(viewerEdit.data ?? []).toHaveLength(0);
    const bad = await owner.client
      .from("site_settings")
      .update({ visibility_providers: ["openai", "bogus"] })
      .eq("site_id", siteId);
    expect(bad.error).not.toBeNull();
  });

  it("competitors: editors manage, cross-org blocked", async () => {
    const ok = await owner.client
      .from("competitors")
      .insert({ org_id: orgId, site_id: siteId, name: "Bolt", created_by: owner.id });
    expect(ok.error).toBeNull();
    const dup = await owner.client
      .from("competitors")
      .insert({ org_id: orgId, site_id: siteId, name: "bolt", created_by: owner.id });
    expect(dup.error?.code).toBe("23505");
    const outsiderAdd = await outsider.client
      .from("competitors")
      .insert({ org_id: orgId, site_id: siteId, name: "X", created_by: outsider.id });
    expect(outsiderAdd.error).not.toBeNull();
  });
});
