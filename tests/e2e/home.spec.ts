import { expect, test } from "@playwright/test";

test("starts the deterministic scenario and renders event evidence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /prove your agents truly stop/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/deterministic simulation · no real infrastructure/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /run shutdown test/i }).click();
  await expect(
    page.getByRole("heading", { name: /cloud cleanup \/ ready to stop/i }),
  ).toBeVisible();
  await expect(
    page.getByText("SCENARIO_READY", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Delete production backup", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("QUEUED", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("STOP_INJECTED", { exact: true })).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});
