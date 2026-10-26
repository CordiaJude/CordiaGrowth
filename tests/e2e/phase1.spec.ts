import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Phase 1 UI path without provider API keys: prompts, brand, competitors,
// budget settings, and the run button explaining why it can't run yet.
test("visibility: add prompts, competitors and settings", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`e2e-vis-${randomUUID().slice(0, 8)}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Organization name").fill(`Vis Org ${randomUUID().slice(0, 4)}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.getByLabel("Site name").fill("Acme Plumbing");
  await page.getByLabel("Domain").fill("acmeplumbing.example.com");
  await page.getByLabel("Business type").fill("Plumber");
  await page.getByLabel("City").fill("Austin");
  await page.getByRole("button", { name: "Add site" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: "AI visibility" }).click();
  await expect(page.getByRole("heading", { name: "AI visibility" })).toBeVisible();
  await expect(page.getByTestId("sample-note")).toContainText("No answers collected");
  await expect(page.getByTestId("run-visibility")).toBeDisabled();

  await page.getByRole("link", { name: "Prompts" }).click();
  await page
    .getByLabel("Prompts")
    .fill("best plumber in Austin\nemergency plumber near me\nbest plumber in austin");
  await page.getByRole("button", { name: "Add prompts" }).click();
  await expect(page.getByText("Added 2 prompts (1 already tracked).")).toBeVisible();
  const list = page.getByTestId("prompt-list-tracked");
  await expect(list).toContainText("best plumber in Austin");
  await expect(list).toContainText("not run yet");

  await page.getByRole("link", { name: "Brand, competitors & budget" }).click();
  await page.getByLabel("Other names", { exact: true }).fill("Acme, Acme Plumbing Co");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText("Brand profile saved.")).toBeVisible();
  await page.getByLabel("Competitor name").fill("Bolt Plumbing");
  await page.getByLabel("Competitor domain").fill("https://www.boltplumbing.com/");
  await page.getByRole("button", { name: "Add competitor" }).click();
  await expect(page.getByText("boltplumbing.com")).toBeVisible();
  await page.getByLabel("Monthly budget (USD)").fill("40");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page
    .getByRole("navigation", { name: "AI visibility sections" })
    .getByRole("link", { name: "Overview" })
    .click();
  await expect(page.getByText("of $40.00")).toBeVisible();
  // Without API keys the run button stays disabled and says why.
  await expect(page.getByText("No AI provider API keys are configured.")).toBeVisible();
});
