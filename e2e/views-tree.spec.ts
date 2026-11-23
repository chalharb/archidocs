import { expect, test } from "@playwright/test";
import { PORT, SITES } from "./sites.ts";
import { open, settled } from "./support.ts";

// The decisions site has a Saved View drawn at c3 (`shop:cart-internals`), which once crashed the Views tree.
test.use({ baseURL: `http://127.0.0.1:${PORT}${SITES.decisions}` });

test.describe("the Views tree", () => {
  test("lists a Saved View drawn at c3 under Saved Views, by kind and by Team", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Views" }).click();
    const panel = page.getByRole("dialog", { name: "Views" });
    const tree = panel.getByRole("tree");
    await tree.getByRole("button", { name: "Expand Saved Views" }).click();
    await tree.getByRole("button", { name: "Expand Shop" }).click();
    await expect(tree.getByRole("button", { name: "Cart internals" })).toBeVisible();

    await panel.getByRole("radio", { name: "By Team" }).check();
    await tree.getByRole("button", { name: "Expand Storefront" }).click();
    await expect(tree.getByRole("button", { name: "Cart internals" })).toBeVisible();

    await tree.getByRole("button", { name: "Cart internals" }).click();
    await settled(page);
    await expect(page.getByRole("navigation", { name: "Breadcrumbs" }).getByRole("listitem")).toHaveText(["Saved", "Shop", "Cart internals"]);
  });
});

test.describe("the rail", () => {
  test("shows one of Find, Model, Views and Teams at a time", async ({ page }) => {
    await open(page, "#/view/c2");
    const rail = page.getByRole("navigation", { name: "Rail" });
    const find = page.getByRole("dialog", { name: "Find" });

    await rail.getByRole("button", { name: "Find" }).click();
    await expect(find).toBeVisible();

    await rail.getByRole("button", { name: "Model" }).click();
    await expect(page.getByRole("dialog", { name: "Model" })).toBeVisible();
    await expect(find).toHaveCount(0);

    await rail.getByRole("button", { name: "Views" }).click();
    await expect(page.getByRole("dialog", { name: "Views" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Model" })).toHaveCount(0);

    await rail.getByRole("button", { name: "Find" }).click();
    await expect(find).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Views" })).toHaveCount(0);
  });
});
