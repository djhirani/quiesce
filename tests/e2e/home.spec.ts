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
  await page.getByRole("button", { name: "Inject STOP", exact: true }).click();
  await expect(
    page.getByText("STOP did not propagate", { exact: true }),
  ).toBeVisible();
  const topology = page.getByLabel("Current authority topology");
  await expect(
    topology
      .locator(".topology-node")
      .filter({ hasText: "Root cleanup agent" }),
  ).toContainText("STOPPED");
  await expect(
    topology
      .locator(".topology-node")
      .filter({ hasText: "Optimisation child" }),
  ).toContainText("ACTIVE");
  await expect(
    topology
      .locator(".topology-node")
      .filter({ hasText: "Temporary cleanup credential" }),
  ).toContainText("VALID");
  await expect(
    topology
      .locator(".topology-node")
      .filter({ hasText: "Recurring cleanup job" }),
  ).toContainText("ARMED");
  await expect(
    topology
      .locator(".topology-node")
      .filter({ hasText: "Cleanup retry worker" }),
  ).toContainText("ACTIVE");
  await expect(
    page.getByText("QUEUED · COMMITTABLE", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: /advance logical time \+5 min/i }),
  ).toBeEnabled();
  await expect(page.getByText("EFFECT_COMMITTED", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: /advance logical time \+5 min/i })
    .click();
  await expect(page.getByText("CLOCK_ADVANCED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("EFFECT_COMMITTED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("QUIESCENCE TEST: FAILED", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("NOT ACHIEVED", { exact: true })).toHaveCount(2);
  await expect(
    page.getByText("One material simulated effect committed after STOP.", {
      exact: true,
    }),
  ).toBeVisible();
  const effect = page.getByRole("button", {
    name: /escaped effect · production backup deletion/i,
  });
  await effect.click();
  await expect(effect).toHaveAttribute("aria-pressed", "true");
  await expect(topology.locator(".topology-node--selected")).toHaveCount(5);
  await expect(page.locator(".ledger tr.is-cited")).toHaveCount(4);
  await page.getByRole("button", { name: "Replay protected" }).click();
  await expect(
    page.getByText("SEAL → REVOKE → DRAIN → PROVE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ZERO RESIDUAL AUTHORITY", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "COMMIT_GATE_SEALED" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /advance logical time \+5 min/i })
    .click();
  await expect(
    page.getByText("STALE_AUTHORITY_REJECTED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("EFFECT_REJECTED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("QUIESCENCE TEST: PASSED", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("420 MS", { exact: true })).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Vulnerable versus protected" }),
  ).toBeVisible();
  await expect(page.getByText("EFFECT_COMMITTED", { exact: true })).toHaveCount(
    0,
  );
  await expect(topology.locator(".topology-node--blocked")).toHaveCount(5);
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});
