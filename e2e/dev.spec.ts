import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveDev, type DevServer } from "../src/cli/dev.ts";
import { checkoutAt } from "../src/workspace/index.ts";
import { viewerWorkspace } from "../test/support/fixtures.ts";
import { writeWorkspace } from "../test/support/workspace.ts";
import { node, settled } from "./support.ts";

// `archidocs dev` over the viewer e2e/serve.ts builds, against a Workspace this test edits.
const viewerDir = fileURLToPath(new URL("../dist/viewer/", import.meta.url));

test.describe("archidocs dev", () => {
  let dev: DevServer | undefined;
  test.afterEach(async () => dev?.close());

  test("swaps a new Bundle in place, keeping the camera, selection and open boxes", async ({ page }) => {
    const { root } = await writeWorkspace(viewerWorkspace);
    dev = await serveDev({ checkout: checkoutAt(root), viewerDir, port: 0 });
    const place = "#/view/c2?open=shop:checkout&sel=shop:cart";
    await page.goto(`${dev.url}${place}`);
    await settled(page);

    // Move the camera off its fit, and mark the page so a reload would show.
    await page.locator("[data-canvas]").hover();
    await page.mouse.wheel(0, 300);
    const camera = () => page.locator(".react-flow__viewport").evaluate((el) => getComputedStyle(el).transform);
    await expect.poll(camera).not.toBe("none");
    const moved = await camera();
    await page.evaluate(() => ((window as unknown as { stayed: boolean }).stayed = true));

    const systems = join(root, "shop/systems.yaml");
    await writeFile(systems, (await readFile(systems, "utf8")).replace("name: Checkout\n", "name: Checkout v2\n"));

    await expect(node(page, "shop:checkout")).toContainText("Checkout v2", { timeout: 10_000 });
    await settled(page);
    expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
    expect(new URL(page.url()).hash).toBe(place);
    expect(await camera()).toBe(moved);
    await expect(node(page, "shop:cart")).toBeVisible();
  });
});
