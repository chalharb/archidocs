import { expect, test } from "@playwright/test";
import { hash, node, settled } from "./support.ts";
import { PORT, SITES } from "./sites.ts";

test.use({ baseURL: `http://127.0.0.1:${PORT}${SITES.preview}` });

test.describe("A PR preview site", () => {
  test("opens with Compare base → PR applied", async ({ page }) => {
    const index = await (await page.request.get("bundles/index.json")).json();
    const base = (index.preview.baseSha as string).slice(0, 7);

    await page.goto("./");
    await settled(page);

    expect(hash(page)).toBe(`#/view/c2?vs=${base}`);
    await expect(page.getByRole("region", { name: "Compare" })).toContainText("Compare main → PR");
    await expect(node(page, "shop:wishlist")).toHaveAttribute("data-change", "added");
    await expect(node(page, "shop:web")).toHaveAttribute("data-change", "changed");
    await expect(node(page, "shop:legacy")).toHaveAttribute("data-change", "removed");
  });

  test("opens a link to a place as it is, without Compare", async ({ page }) => {
    await page.goto("./#/view/c1");
    await settled(page);

    expect(hash(page)).toBe("#/view/c1");
    await expect(page.getByRole("region", { name: "Compare" })).toHaveCount(0);
  });
});
