import { expect, test } from "@playwright/test";

test("explains the methodology honestly and links back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Methodology" }).click();
  await expect(
    page.getByRole("heading", { name: "How Quiesce proves a shutdown" }),
  ).toBeVisible();
  for (const topic of [
    "Deterministic scenario",
    "Commit fencing",
    "Time to Quiescence",
    "Quiescence Sweep",
    "GPT-5.6 roles",
    "Certificate hashing",
    "Limitations",
  ]) {
    await expect(page.getByRole("heading", { name: topic })).toBeVisible();
  }
  await expect(
    page.getByText(
      /deterministic simulated environment · no real infrastructure/i,
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to instrument" }).click();
  await expect(
    page.getByRole("heading", { name: /prove your agents truly stop/i }),
  ).toBeVisible();
});
