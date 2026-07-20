import { expect, test } from "@playwright/test";

test("foundation remains usable and honest", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /prove your agents truly stop/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/deterministic simulation · no real infrastructure/i),
  ).toBeVisible();
  await page.getByRole("link", { name: /run shutdown test/i }).click();
  await expect(
    page.getByRole("heading", { name: /cloud cleanup \/ standby/i }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});
