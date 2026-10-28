import { describe, expect, it } from "vitest";
import { missingConfig, setupRequiredHtml } from "@/lib/config-status";

const full = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  ENCRYPTION_KEYS: "1:abc",
};

describe("missingConfig", () => {
  it("is empty when everything is set", () => {
    expect(missingConfig(full)).toEqual([]);
  });

  it("lists missing or blank variables by name", () => {
    const names = missingConfig({ ...full, NEXT_PUBLIC_SUPABASE_URL: undefined, ENCRYPTION_KEYS: "  " }).map(
      (m) => m.name,
    );
    expect(names).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "ENCRYPTION_KEYS"]);
  });

  it("renders names and hints, never values, escaped", () => {
    const html = setupRequiredHtml(missingConfig({ ...full, SUPABASE_SECRET_KEY: undefined }));
    expect(html).toContain("<code>SUPABASE_SECRET_KEY</code>");
    expect(html).not.toContain("sb_publishable_x");
    expect(setupRequiredHtml([{ name: "<x>", hint: "a&b" }])).toContain(
      "<code>&lt;x&gt;</code><span>a&amp;b</span>",
    );
  });
});
