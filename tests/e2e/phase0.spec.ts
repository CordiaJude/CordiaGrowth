import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// The Phase 0 "done" path: sign up, create an org, add a site, run a test job.
// Needs local Supabase running and outbound internet (the job fetches the site).
test("sign up → create org → add site → run test job", async ({ page }) => {
  const email = `e2e-${randomUUID().slice(0, 8)}@test.local`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Organization name").fill(`E2E Org ${randomUUID().slice(0, 4)}`);
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(page).toHaveURL(/\/o\/[a-z0-9-]+\/sites\/new$/);
  await page.getByLabel("Site name").fill("Example");
  await page.getByLabel("Domain").fill("https://www.example.com/");
  await page.getByLabel("Business type").fill("Documentation");
  await page.getByRole("button", { name: "Add site" }).click();

  await expect(page).toHaveURL(/\/o\/[a-z0-9-]+\/s\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Example" })).toBeVisible();
  await expect(page.getByTestId("site-switcher")).toContainText("example.com");

  await page.getByTestId("run-test-job").click();
  await expect(page.getByTestId("job-status").first()).toHaveText(/succeeded/, { timeout: 45_000 });
  await expect(page.getByTestId("job-output")).toContainText('"status": 200');

  // Guardrail: auto-publish defaults to off.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByTestId("setting-Auto-publish")).toHaveText("Off");

  // Signed-out users are bounced to login.
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
});
