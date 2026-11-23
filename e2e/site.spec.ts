import { expect, test } from "@playwright/test";
import { PORT, SITES } from "./sites.ts";
import { nodeIds, open } from "./support.ts";

test.describe("the built site", () => {
  test("works under a sub-path: every request stays under it and succeeds", async ({ page }) => {
    const requests: { url: string; status: number }[] = [];
    page.on("response", (r) => requests.push({ url: r.url(), status: r.status() }));
    await open(page, "#/view/c2");

    expect(await nodeIds(page)).toContain("shop:checkout");
    const base = `http://127.0.0.1:${PORT}${SITES.landscape}`;
    expect(requests.map((r) => r.url)).toContain(`${base}workspace.bundle.json`);
    for (const r of requests) {
      expect(r.url.startsWith(base) || r.url.startsWith("blob:") || r.url.startsWith("data:")).toBe(true);
      expect(r.status).toBeLessThan(400);
    }
  });

  test("runs layout in a web worker", async ({ page }) => {
    const workers: string[] = [];
    page.on("worker", (w) => workers.push(w.url()));
    await open(page, "#/view/c2");
    expect(workers.length).toBe(1);
  });

  test("two sites on one host keep separate Recent lists", async ({ page }) => {
    await open(page, "#/view/c1");
    await page.goto(`${SITES.big}#/view/c1`);
    await page.getByRole("button", { name: "Recent" }).click();
    await expect(page.getByRole("menu", { name: "Recent" }).getByRole("menuitem")).toHaveText(["C1 Landscape"]);
  });

  test("names the page after the View", async ({ page }) => {
    await open(page, "#/view/c2/shop:checkout");
    await expect(page).toHaveTitle("Checkout (C2) · Archidocs");
  });
});
