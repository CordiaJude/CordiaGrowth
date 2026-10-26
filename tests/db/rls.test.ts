import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, newOrg, newSite, newUser, type Client } from "./helpers";

type U = Awaited<ReturnType<typeof newUser>>;

let alice: U; // owner of org A
let bob: U; // owner of org B, later a viewer in org A
let carol: U; // editor in org A
let orgA: { id: string };
let orgB: { id: string };
let siteA: { id: string };
let siteB: { id: string };

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([newUser("alice"), newUser("bob"), newUser("carol")]);
  orgA = await newOrg(alice.client, "Org A");
  orgB = await newOrg(bob.client, "Org B");
  siteA = await newSite(alice.client, orgA.id, alice.id, "alpha-example.com");
  siteB = await newSite(bob.client, orgB.id, bob.id, "bravo-example.com");
  const { error } = await alice.client
    .from("memberships")
    .insert({ org_id: orgA.id, user_id: carol.id, role: "editor" });
  if (error) throw error;
});

async function visibleIds(client: Client, table: "organizations" | "sites" | "site_settings" | "job_runs") {
  const { data, error } = await client.from(table).select("*");
  if (error) throw error;
  return (data as Record<string, string>[]).map((r) => r.id ?? r.site_id);
}

describe("tenant isolation", () => {
  it("creating an org makes the creator its owner", async () => {
    const { data } = await alice.client
      .from("memberships")
      .select("role")
      .eq("org_id", orgA.id)
      .eq("user_id", alice.id)
      .single();
    expect(data?.role).toBe("owner");
  });

  it("users only see their own orgs, sites and settings", async () => {
    expect(await visibleIds(alice.client, "organizations")).toContain(orgA.id);
    expect(await visibleIds(alice.client, "organizations")).not.toContain(orgB.id);
    expect(await visibleIds(bob.client, "sites")).not.toContain(siteA.id);
    expect(await visibleIds(bob.client, "site_settings")).not.toContain(siteA.id);
    expect(await visibleIds(alice.client, "sites")).not.toContain(siteB.id);
  });

  it("anonymous users see nothing", async () => {
    for (const table of ["organizations", "sites", "memberships", "job_runs", "profiles"] as const) {
      const { data } = await anon().from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("cannot create a site in someone else's org", async () => {
    const { error } = await bob.client
      .from("sites")
      .insert({ org_id: orgA.id, name: "x", domain: "intruder-example.com", created_by: bob.id });
    expect(error).not.toBeNull();
  });

  it("cannot update or delete another org's site", async () => {
    const upd = await bob.client.from("sites").update({ name: "pwned" }).eq("id", siteA.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await bob.client.from("sites").delete().eq("id", siteA.id).select();
    expect(del.data ?? []).toHaveLength(0);
    const { data } = await admin().from("sites").select("name").eq("id", siteA.id).single();
    expect(data?.name).toBe("alpha-example.com");
  });

  it("cannot insert organizations directly (only via create_organization)", async () => {
    const { error } = await alice.client.from("organizations").insert({ name: "x", slug: "direct-insert" });
    expect(error).not.toBeNull();
  });

  it("cannot add yourself to another org", async () => {
    const { error } = await bob.client
      .from("memberships")
      .insert({ org_id: orgA.id, user_id: bob.id, role: "owner" });
    expect(error).not.toBeNull();
  });

  it("cannot enqueue a job in another org, or point a job at another org's site", async () => {
    const other = await bob.client
      .from("job_runs")
      .insert({ org_id: orgA.id, site_id: siteA.id, task_id: "site-healthcheck", triggered_by: bob.id });
    expect(other.error).not.toBeNull();

    // Bob owns org B but uses org A's site id inside it.
    const crossSite = await bob.client
      .from("job_runs")
      .insert({ org_id: orgB.id, site_id: siteA.id, task_id: "site-healthcheck", triggered_by: bob.id });
    expect(crossSite.error).not.toBeNull();
  });
});

describe("roles", () => {
  beforeAll(async () => {
    const { error } = await alice.client
      .from("memberships")
      .insert({ org_id: orgA.id, user_id: bob.id, role: "viewer" });
    if (error) throw error;
  });

  it("viewers can read but not write", async () => {
    expect(await visibleIds(bob.client, "sites")).toContain(siteA.id);

    const ins = await bob.client
      .from("sites")
      .insert({ org_id: orgA.id, name: "x", domain: "viewer-example.com", created_by: bob.id });
    expect(ins.error).not.toBeNull();

    const upd = await bob.client
      .from("site_settings")
      .update({ auto_publish: true })
      .eq("site_id", siteA.id)
      .select();
    expect(upd.data ?? []).toHaveLength(0);

    const job = await bob.client
      .from("job_runs")
      .insert({ org_id: orgA.id, site_id: siteA.id, task_id: "site-healthcheck", triggered_by: bob.id });
    expect(job.error).not.toBeNull();
  });

  it("members can see org-mates' profiles but not strangers'", async () => {
    const stranger = await newUser("dave");
    const { data } = await bob.client.from("profiles").select("id");
    const ids = (data ?? []).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([alice.id, carol.id]));
    expect(ids).not.toContain(stranger.id);
  });

  it("editors can create sites and enqueue jobs, but cannot change roles or delete sites", async () => {
    const site = await newSite(carol.client, orgA.id, carol.id, "carol-example.com");
    const job = await carol.client
      .from("job_runs")
      .insert({ org_id: orgA.id, site_id: site.id, task_id: "site-healthcheck", triggered_by: carol.id })
      .select("status")
      .single();
    expect(job.error).toBeNull();
    expect(job.data?.status).toBe("queued");

    const promote = await carol.client
      .from("memberships")
      .update({ role: "owner" })
      .eq("user_id", carol.id)
      .eq("org_id", orgA.id)
      .select();
    expect(promote.data ?? []).toHaveLength(0);

    const del = await carol.client.from("sites").delete().eq("id", site.id).select();
    expect(del.data ?? []).toHaveLength(0);
  });

  it("users cannot mark job runs as finished (workers only)", async () => {
    const { data: run } = await carol.client
      .from("job_runs")
      .insert({ org_id: orgA.id, site_id: siteA.id, task_id: "site-healthcheck", triggered_by: carol.id })
      .select("id")
      .single();
    const upd = await carol.client.from("job_runs").update({ status: "succeeded" }).eq("id", run!.id);
    expect(upd.error).not.toBeNull();
  });

  it("tenancy and ownership columns are immutable for end users", async () => {
    const moveSite = await alice.client.from("sites").update({ org_id: orgB.id }).eq("id", siteA.id);
    expect(moveSite.error).not.toBeNull();
    const reassign = await alice.client
      .from("memberships")
      .update({ user_id: bob.id })
      .eq("org_id", orgA.id)
      .eq("user_id", carol.id);
    expect(reassign.error).not.toBeNull();
    const rename = await alice.client.from("organizations").update({ slug: "hijack" }).eq("id", orgA.id);
    expect(rename.error).not.toBeNull();
  });

  it("an org can't lose its last owner", async () => {
    const { error } = await alice.client
      .from("memberships")
      .update({ role: "editor" })
      .eq("org_id", orgA.id)
      .eq("user_id", alice.id);
    expect(error?.message).toMatch(/at least one owner/);
    const leave = await alice.client
      .from("memberships")
      .delete()
      .eq("org_id", orgA.id)
      .eq("user_id", alice.id);
    expect(leave.error?.message).toMatch(/at least one owner/);
  });

  it("owners can delete their org (cascades past the last-owner guard)", async () => {
    const temp = await newOrg(alice.client, "Temp");
    const { error } = await alice.client.from("organizations").delete().eq("id", temp.id);
    expect(error).toBeNull();
    const { data } = await admin().from("organizations").select("id").eq("id", temp.id);
    expect(data).toHaveLength(0);
  });
});

describe("site settings and integrations", () => {
  it("every new site gets settings with auto-publish OFF", async () => {
    const { data } = await alice.client.from("site_settings").select("*").eq("site_id", siteA.id).single();
    expect(data?.auto_publish).toBe(false);
    expect(data?.visibility_runs_per_prompt).toBe(3);
  });

  it("members can never read encrypted credentials", async () => {
    await admin().from("integrations").insert({
      org_id: orgA.id,
      site_id: siteA.id,
      provider: "wordpress",
      encrypted_credentials: "v1.ciphertext",
      key_version: 1,
    });
    const all = await alice.client.from("integrations").select("*");
    expect(all.error).not.toBeNull();
    const cred = await alice.client.from("integrations").select("encrypted_credentials");
    expect(cred.error).not.toBeNull();
    const safe = await alice.client
      .from("integrations")
      .select("id, provider, status")
      .eq("site_id", siteA.id);
    expect(safe.error).toBeNull();
    expect(safe.data).toHaveLength(1);
    const other = await bob.client.from("integrations").select("id").eq("site_id", siteB.id);
    expect(other.data ?? []).toHaveLength(0);
  });

  it("an integration can't reference another org's site", async () => {
    const { error } = await admin()
      .from("integrations")
      .insert({ org_id: orgA.id, site_id: siteB.id, provider: "gsc" });
    expect(error?.message).toMatch(/does not belong/);
  });
});
