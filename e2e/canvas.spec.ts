import { expect, test } from "@playwright/test";
import { layoutProblems } from "../test/render/geometry.ts";
import { SITES } from "./sites.ts";
import { hash, node, nodeIds, open, renderedGeometry, settled } from "./support.ts";

test.describe("expand and collapse", () => {
  test("the C2 Landscape opens every System; − closes one into closed=, which a reload keeps, and + opens it again", async ({ page }) => {
    await open(page, "#/view/c2");
    for (const id of ["shop:cart", "shop:cart-db", "shop:fraud-check", "shop:order-history"]) await expect(node(page, id)).toHaveAttribute("data-parent", "shop:checkout");
    await expect(node(page, "payments:payments-api")).toHaveAttribute("data-parent", "payments:payments");

    await page.getByRole("button", { name: "Collapse Checkout" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?closed=shop:checkout");
    await expect(node(page, "shop:cart")).toHaveCount(0);
    await expect(node(page, "payments:payments-api")).toHaveCount(1);

    await page.reload();
    await settled(page);
    await expect(node(page, "shop:cart")).toHaveCount(0);

    await page.getByRole("button", { name: "Expand Checkout" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2");
    await expect(node(page, "shop:cart")).toHaveAttribute("data-parent", "shop:checkout");
  });

  test("an old link that opens a System on the C2 Landscape still shows it open", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    await expect(node(page, "shop:cart")).toHaveAttribute("data-parent", "shop:checkout");
  });

  test("a Service with Components opens inside an open System", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Expand Cart" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=shop:cart");
    await expect(node(page, "shop:checkout-ui")).toHaveAttribute("data-parent", "shop:cart");
  });

  test("the focus of a C2 or C3 View can't be collapsed, and boxes without children have no +", async ({ page }) => {
    await open(page, "#/view/c2/shop:checkout");
    await expect(page.getByRole("button", { name: "Collapse Checkout" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand Cart DB" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Expand Cart" })).toBeVisible();
  });
});

test.describe("the way in", () => {
  test("a System's arrow tile goes down one level: C1 to the C2 Landscape, there to its own View", async ({ page }) => {
    await open(page, "#/view/c1");
    await expect(node(page, "shop:shopper").getByRole("button", { name: /^Open / })).toHaveCount(0);
    await node(page, "shop:checkout").getByRole("button", { name: "Open Checkout on the C2 Landscape" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?sel=shop:checkout");
    await expect(node(page, "shop:checkout")).toHaveClass(/arc-selected/);
    await expect(node(page, "shop:checkout")).toBeInViewport();

    await node(page, "shop:checkout").getByRole("button", { name: "Open Checkout's View" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
    // On its own View the System is the open box, so it offers no way in to itself; a Person never does.
    await expect(node(page, "shop:checkout").getByRole("button", { name: "Open Checkout's View" })).toHaveCount(0);
    await expect(node(page, "shop:shopper").getByRole("button", { name: /Open .* View/ })).toHaveCount(0);
  });

  test("Go deeper on the plate lists the Views one level down", async ({ page }) => {
    await open(page, "#/view/c1");
    await page.getByRole("button", { name: "Go deeper" }).click();
    await page.getByRole("menu", { name: "Go deeper" }).getByRole("menuitem", { name: "C2 Landscape" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2");

    await page.getByRole("button", { name: "Go deeper" }).click();
    await page.getByRole("menu", { name: "Go deeper" }).getByRole("menuitem", { name: "Checkout" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
  });
});

test.describe("double-click", () => {
  test("opens a System on C1 in the C2 Landscape, selected, and on the C2 Landscape in its own View", async ({ page }) => {
    await open(page, "#/view/c1");
    await node(page, "shop:checkout").dblclick();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?sel=shop:checkout");

    await node(page, "shop:checkout").getByTestId("name").dblclick();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
  });

  test("opens a Service with Components in its C3 View, and one without in its System's C2 View", async ({ page }) => {
    await open(page, "#/view/c2");
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
      // A faded edge steps back to a fainter stroke; it stays fully drawn, so it never vanishes.
      const styles = await edges.evaluateAll((paths) =>
        paths.map((p) => {
          const style = getComputedStyle(p);
          return { touches: [p.getAttribute("data-edge-from"), p.getAttribute("data-edge-to")].includes("shop:cart"), stroke: style.stroke, opacity: Number(style.opacity) };
        }),
      );
      const touching = styles.filter((e) => e.touches);
      const others = styles.filter((e) => !e.touches);
      expect(touching.length).toBeGreaterThan(0);
      expect(others.length).toBeGreaterThan(0);
      for (const e of styles) expect(e.opacity).toBe(1);
      for (const e of others) expect(e.stroke).not.toBe(touching[0]!.stroke);
      expect(new Set(touching.map((e) => e.stroke)).size).toBe(1);
    }).toPass();

    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout");
    await expect(node(page, "shop:cart")).toHaveAttribute("aria-selected", "false");
  });
});

test.describe("edge hover", () => {
  test("lights the hovered edge and its two ends, fades the rest, and restores the selection on leave", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    await node(page, "shop:cart").click();
    const edges = page.locator("path[data-edge-from]");
    const before = await edges.evaluateAll((paths) => paths.map((p) => `${p.getAttribute("data-edge-from")}>${p.getAttribute("data-edge-to")} ${p.getAttribute("class")}`).sort());

    // An edge that doesn't touch the selected Cart, hovered at a point along its line that nothing covers.
    const spot = await page.locator(".arc-edge-hit:not([data-edge-hit*='shop:cart'])").evaluateAll((paths) => {
      for (const p of paths as SVGPathElement[]) {
        const at = p.getPointAtLength(p.getTotalLength() / 2);
        const { x, y } = new DOMPoint(at.x, at.y).matrixTransform(p.getScreenCTM()!);
        if (document.elementFromPoint(x, y) === p) return { id: p.getAttribute("data-edge-hit")!, x, y };
      }
      return null;
    });
    expect(spot).not.toBeNull();
    const [from, to] = spot!.id.split(">") as [string, string];
    await page.mouse.move(spot!.x, spot!.y);

    const hovered = page.locator(`path[data-edge-from="${from}"][data-edge-to="${to}"]`);
    await expect(hovered).toHaveClass(/arc-lit/);
    await expect(node(page, from)).toHaveAttribute("data-hover", "end");
    await expect(node(page, to)).toHaveAttribute("data-hover", "end");
    await expect(node(page, "shop:cart")).toHaveAttribute("data-hover", "faded");
    const others = await edges.evaluateAll((paths, id) => paths.filter((p) => `${p.getAttribute("data-edge-from")}>${p.getAttribute("data-edge-to")}` !== id).map((p) => p.getAttribute("class")), `${from}>${to}`);
    expect(others.length).toBeGreaterThan(0);
    for (const c of others) expect(c).toContain("arc-faded");
    // The lit edge draws over the others.
    expect(await edges.evaluateAll((paths) => paths.at(-1)?.getAttribute("data-edge-from") + ">" + paths.at(-1)?.getAttribute("data-edge-to"))).toBe(`${from}>${to}`);

    await page.mouse.move(2, 2);
    await expect(node(page, from)).not.toHaveAttribute("data-hover", /.*/);
    await expect(async () => {
      const after = await edges.evaluateAll((paths) => paths.map((p) => `${p.getAttribute("data-edge-from")}>${p.getAttribute("data-edge-to")} ${p.getAttribute("class")}`).sort());
      expect(after).toEqual(before);
    }).toPass();
    await expect(node(page, "shop:cart")).toHaveAttribute("aria-selected", "true");
  });

  test("an edge inside open boxes can be hovered: they never cover it", async ({ page }) => {
    await open(page, "#/view/deployment/prod");
    // Every edge has a point along its line where the pointer finds its hover target, not a box drawn over it.
    const reachable = await page.locator(".arc-edge-hit").evaluateAll((paths) =>
      (paths as SVGPathElement[]).map((p) => {
        const length = p.getTotalLength();
        const found = [0.2, 0.35, 0.5, 0.65, 0.8].some((f) => {
          const at = p.getPointAtLength(length * f);
          const { x, y } = new DOMPoint(at.x, at.y).matrixTransform(p.getScreenCTM()!);
          return x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y) === p;
        });
        return { id: p.getAttribute("data-edge-hit")!, inside: document.querySelector(`[data-node="${p.getAttribute("data-edge-hit")!.split(">")[0]}"]`)?.getAttribute("data-parent") !== "", found };
      }),
    );
    expect(reachable.filter((e) => e.inside).length).toBeGreaterThan(0);
    expect(reachable.filter((e) => !e.found).map((e) => e.id)).toEqual([]);
  });

  test("the tooltip names the two ends and what the Relationship says", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    const titles = await page.locator(".arc-edge-hit title").allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/.+ → .+/);
    expect(titles.some((t) => t.includes("\n"))).toBe(true);
  });
});

test.describe("direction", () => {
  test("defaults to LR and redraws the View in the direction picked", async ({ page }) => {
    await open(page, "#/view/c1");
    const direction = page.getByLabel("Direction");
    await expect(direction).toHaveValue("LR");
    const lr = await node(page, "shop:shopper").boundingBox();
    const lrWeb = await node(page, "shop:web").boundingBox();
    expect(lrWeb!.x).toBeGreaterThan(lr!.x + lr!.width);

    await direction.selectOption("TB");
    await settled(page);
    expect(hash(page)).toBe("#/view/c1?dir=TB");
    const tb = await node(page, "shop:shopper").boundingBox();
    const tbWeb = await node(page, "shop:web").boundingBox();
    expect(tbWeb!.y).toBeGreaterThan(tb!.y + tb!.height);
  });
});

test.describe("rendered geometry meets the layout rules", () => {
  test.use({ reducedMotion: "reduce" });
  const places = ["#/view/c1", "#/view/c2", "#/view/c2?closed=shop:checkout", "#/view/c2?open=shop:checkout,payments:payments,shop:cart", "#/view/c2/shop:checkout?open=shop:cart", "#/view/c3/shop:cart", "#/view/c2?open=shop:checkout&dir=TB", "#/view/c2/shop:checkout?dir=RL", "#/view/c3/shop:cart?dir=BT"];
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
    // The Team colour is the box's own left edge, as in the Variant D prototype.
    const stripe = (id: string) => node(page, id).evaluate((el) => getComputedStyle(el).borderLeftColor);
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

test.describe("the Key", () => {
  test("starts folded on a roomy screen and remembers a visitor's own toggle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "#/view/c1");
    const key = page.locator(".arc-key");
    await expect(key).not.toHaveAttribute("open");

    await key.locator("summary").click();
    await expect(key).toHaveAttribute("open");
    await page.reload();
    await settled(page);
    await expect(page.locator(".arc-key")).toHaveAttribute("open");
  });

  test("lists the icons the View draws: a Person and a System on C1, no Deployment Target", async ({ page }) => {
    await open(page, "#/view/c1");
    await page.locator(".arc-key summary").click();
    const icons = page.getByRole("list", { name: "Icons" });
    await expect(icons.getByRole("listitem").filter({ hasText: "Person" })).toBeVisible();
    await expect(icons.getByRole("listitem").filter({ hasText: /^System$/ })).toBeVisible();
    await expect(icons.locator('[data-key-icon="target"]')).toHaveCount(0);
  });

  test("a Deployment View's Key lists the Deployment Target icon", async ({ page }) => {
    await open(page, "#/view/deployment/prod");
    await page.locator(".arc-key summary").click();
    await expect(page.getByRole("list", { name: "Icons" }).locator('[data-key-icon="target"]')).toHaveText("Deployment Target");
  });
});
