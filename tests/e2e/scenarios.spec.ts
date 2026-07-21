import { expect, test } from "@playwright/test";

test("switches scenarios with disclosure, clean reset, and working flow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Cloud cleanup", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      "Reconstruction of a documented incident class — simulated.",
      {
        exact: true,
      },
    ),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: "The nine-second deletion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "The nine-second deletion", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      "Reconstruction of a documented incident class — simulated.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(page.getByText(/incident library/i)).toBeVisible();
  await expect(
    page.getByText(/quiesce did not observe the original incident/i),
  ).toBeVisible();

  await page.getByRole("button", { name: /run shutdown test/i }).click();
  await expect(
    page.getByRole("heading", {
      name: /the nine-second deletion \/ ready to stop/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Drop and recreate production database", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inject STOP", exact: true }).click();
  await page
    .getByRole("button", { name: /advance logical time \+5 min/i })
    .click();
  await expect(
    page.getByText("QUIESCENCE TEST: FAILED", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Cloud cleanup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /cloud cleanup \/ standby/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Authority graph awaiting a deterministic run.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("STOP_INJECTED", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("QUIESCENCE TEST: FAILED", { exact: true }),
  ).toHaveCount(0);
});

test("runs the full test suite and focuses a row result", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Run full test suite", exact: true })
    .click();
  await expect(page.locator(".suite-table tbody tr")).toHaveCount(6);
  await expect(page.locator(".suite-table td.is-fail")).toHaveCount(3);
  await expect(page.locator(".suite-table td.is-pass")).toHaveCount(3);
  await expect(
    page.getByText(/suite complete · 6 deterministic runs/i),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Focus The offboarded token protected result",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /the offboarded token \/ protected proof complete/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("QUIESCENCE TEST: PASSED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "The offboarded token", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
