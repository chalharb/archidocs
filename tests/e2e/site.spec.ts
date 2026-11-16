import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("lists the view names from the model", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("System context")).toBeVisible();
});

test("keeps listing views after a reload", async ({ page }) => {
  await page.goto("./#/");
  await page.reload();
  await expect(page.getByText("System context")).toBeVisible();
});

test("has no detectable accessibility violations on the start page", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("System context")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
