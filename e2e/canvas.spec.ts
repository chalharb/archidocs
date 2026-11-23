import { expect, test } from "@playwright/test";
import { layoutProblems } from "../test/render/geometry.ts";
import { SITES } from "./sites.ts";
import { hash, node, nodeIds, open, renderedGeometry, settled } from "./support.ts";

test.describe("expand and collapse", () => {
  test("+ opens a System to show its Services, − closes it", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Expand Checkout" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout");
    for (const id of ["shop:cart", "shop:cart-db", "shop:fraud-check", "shop:order-history"]) await expect(node(page, id)).toHaveAttribute("data-parent", "shop:checkout");

    await page.getByRole("button", { name: "Collapse Checkout" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2");
    await expect(node(page, "shop:cart")).toHaveCount(0);
  });

  test("a Service with Components opens inside an open System", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    await page.getByRole("button", { name: "Expand Cart" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout,shop:cart");
    await expect(node(page, "shop:checkout-ui")).toHaveAttribute("data-parent", "shop:cart");
  });

  test("the focus of a C2 or C3 View can't be collapsed, and boxes without children have no +", async ({ page }) => {
    await open(page, "#/view/c2/shop:checkout");
    await expect(page.getByRole("button", { name: "Collapse Checkout" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand Cart DB" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand Cart" })).toBeVisible();
  });
});

test.describe("double-click", () => {
  test("opens a System's C2 View", async ({ page }) => {
    await open(page, "#/view/c1");
    await node(page, "shop:checkout").dblclick();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
  });

  test("opens a Service with Components in its C3 View, and one without in its System's C2 View", async ({ page }) => {
    await open(page, "#/view/c2?open=payments:payments");
    await node(page, "payments:payments-api").dblclick();
    await settled(page);
    expect(hash(page)).toBe("#/view/c3/payments:payments-api");

    await open(page, "#/view/c2/payments:payments");
    await node(page, "shop:checkout").dblclick();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
    await node(page, "shop:cart-db").dblclick();
    await page.waitForTimeout(300);
    expect(hash(page)).toBe("#/view/c2/shop:checkout?sel=shop:cart-db");
  });
});

test.describe("selection", () => {
  test("fades the edges that don't touch the selected node; clicking the background clears it", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    await node(page, "shop:cart").click();
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout&sel=shop:cart");

    const edges = page.locator("path[data-edge-from]");
    await expect(async () => {
      const opacities = await edges.evaluateAll((paths) =>
        paths.map((p) => ({ touches: [p.getAttribute("data-edge-from"), p.getAttribute("data-edge-to")].includes("shop:cart"), opacity: Number(getComputedStyle(p).opacity) })),
      );
      expect(opacities.filter((e) => e.touches).length).toBeGreaterThan(0);
      expect(opacities.filter((e) => !e.touches).length).toBeGreaterThan(0);
      for (const e of opacities) expect(e.opacity < 0.5).toBe(!e.touches);
    }).toPass();

    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout");
    await expect(node(page, "shop:cart")).toHaveAttribute("aria-selected", "false");
  });
});

test.describe("direction", () => {
  test("defaults to LR and redraws the View in the direction picked", async ({ page }) => {
    await open(page, "#/view/c1");
    const direction = page.getByRole("group", { name: "Direction" });
    await expect(direction.getByRole("button", { name: "LR" })).toHaveAttribute("aria-pressed", "true");
    const lr = await node(page, "shop:shopper").boundingBox();
    const lrWeb = await node(page, "shop:web").boundingBox();
    expect(lrWeb!.x).toBeGreaterThan(lr!.x + lr!.width);

    await direction.getByRole("button", { name: "TB" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c1?dir=TB");
    const tb = await node(page, "shop:shopper").boundingBox();
    const tbWeb = await node(page, "shop:web").boundingBox();
    expect(tbWeb!.y).toBeGreaterThan(tb!.y + tb!.height);
  });
});

test.describe("rendered geometry meets the layout rules", () => {
  test.use({ reducedMotion: "reduce" });
  const places = ["#/view/c1", "#/view/c2", "#/view/c2?open=shop:checkout,payments:payments,shop:cart", "#/view/c2/shop:checkout?open=shop:cart", "#/view/c3/shop:cart", "#/view/c2?open=shop:checkout&dir=TB", "#/view/c2/shop:checkout?dir=RL", "#/view/c3/shop:cart?dir=BT"];
  for (const place of places)
    test(place, async ({ page }) => {
      await open(page, place);
      const geometry = await renderedGeometry(page);
      expect(geometry.nodes.length).toBeGreaterThan(1);
      expect(geometry.edges.length).toBeGreaterThan(0);
      expect(layoutProblems(geometry)).toEqual({ overlaps: [], throughNodes: [], diagonal: [], detached: [] });
    });
});

test.describe("animated transitions", () => {
  const transition = (page: import("@playwright/test").Page, id: string) => node(page, id).evaluate((el) => getComputedStyle(el.closest(".react-flow__node")!).transitionDuration);

  test("animate nodes to new positions in a View of up to 100 nodes", async ({ page }) => {
    await open(page, "#/view/c2");
    expect(await transition(page, "shop:checkout")).not.toBe("0s");
  });

  test("are off above 100 nodes", async ({ page }) => {
    const systems = ["a", "b", "c", "d", "e", "f"].map((s) => `land:sys-${s}`).join(",");
    await page.goto(`${SITES.big}#/view/c2?open=${systems}`);
    await settled(page);
    expect((await nodeIds(page)).length).toBeGreaterThan(100);
    expect(await transition(page, "land:sys-a")).toBe("0s");
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("are off", async ({ page }) => {
      await open(page, "#/view/c2");
      expect(await transition(page, "shop:checkout")).toBe("0s");
    });
  });
});

test.describe("Teams and zoom", () => {
  test("each node carries its Team's stripe and code, coloured per Team", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    const team = (id: string) => node(page, id).getByTestId("team");
    await expect(team("shop:cart")).toHaveText("STO");
    await expect(team("shop:fraud-check")).toHaveText("PAY");
    const stripe = (id: string) => node(page, id).getByTestId("stripe").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await stripe("shop:cart")).toBe(await stripe("shop:cart-db"));
    expect(await stripe("shop:cart")).not.toBe(await stripe("shop:fraud-check"));
  });

  test("below 45% zoom, sub-labels and Team codes hide", async ({ page }) => {
    await open(page, "#/view/c2");
    const subLabel = node(page, "shop:web").getByTestId("sublabel");
    const team = node(page, "shop:web").getByTestId("team");
    await expect(subLabel).toBeVisible();
    await expect(team).toBeVisible();

    const zoomOut = page.getByRole("button", { name: "Zoom Out" });
    for (let i = 0; i < 6; i++) await zoomOut.click();
    await expect(subLabel).toBeHidden();
    await expect(team).toBeHidden();
    await expect(node(page, "shop:web")).toContainText("Web");
  });
});
