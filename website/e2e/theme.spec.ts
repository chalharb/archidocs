import { expect, test } from "@playwright/test";

test("a Diagram shows the picture for Starlight's theme, and swaps with the theme toggle", async ({ page }) => {
  await page.goto("/docs/examples/big-bank/");
  const diagram = page.locator('figure.diagram[data-view="big-bank/digital:mainframe-outage"]');
  const light = diagram.locator("img.diagram-light");
  const dark = diagram.locator("img.diagram-dark");
  const theme = page.getByRole("combobox", { name: "Select theme" }).first();

  await theme.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(light).toBeVisible();
  await expect(dark).toBeHidden();
  await expect.poll(() => light.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(dark).toBeVisible();
  await expect(light).toBeHidden();
  await expect.poll(() => dark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

  await expect(diagram.getByRole("link", { name: "Open in the live viewer ↗" })).toHaveAttribute("href", "https://big-bank.archidocs.dev/#/view/digital:mainframe-outage");
});

test("the dark picture follows the system theme when the toggle is on Auto", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/docs/examples/kitchen-sink/");
  await page.getByRole("combobox", { name: "Select theme" }).first().selectOption("auto");
  await expect(page.locator("img.diagram-dark")).toBeVisible();
  await expect(page.locator("img.diagram-light")).toBeHidden();
});
