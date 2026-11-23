import { expect, test, type Page } from "@playwright/test";
import { PORT, SITES } from "./sites.ts";
import { hash, settled } from "./support.ts";

// The sequence chart scenario: `shop:full-checkout` (46 Steps; 37 and 42 are event Steps via the Event Bus) and `shop:pay` (4 Steps).
test.use({ baseURL: `http://127.0.0.1:${PORT}${SITES.checkout}` });

const FULL = "#/view/shop:full-checkout";
const PAY = "#/view/shop:pay";

/** Opens a Dynamic View and waits until its chart is drawn. */
async function openDynamic(page: Page, place: string) {
  await page.goto(`./${place}`);
  await settled(page);
}

const transport = (page: Page) => page.getByRole("group", { name: "Transport" });
const outlineRow = (page: Page, n: number) => page.getByRole("list", { name: "Steps" }).locator(`[data-step="${n}"]`);
const arrow = (page: Page, key: string) => page.locator(`[data-step-edge="${key}"]`);
const tick = (page: Page, n: number) => page.getByRole("button", { name: `Go to Step ${n}`, exact: true });
const detail = (page: Page) => page.getByRole("complementary", { name: "Step detail" });

/** The selected Step everywhere it shows: the URL, the outline, the chart, the progress bar and the detail. */
async function expectSelected(page: Page, n: number) {
  expect(hash(page)).toContain(`step=${n}`);
  await expect(transport(page)).toContainText(`Step ${n} of`);
  await expect(outlineRow(page, n)).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-step-edge][data-selected=true]").first()).toHaveAttribute("data-step", String(n));
  await expect(tick(page, n)).toHaveAttribute("aria-current", "step");
  await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText(`Step ${n}`);
}

test.describe("Dynamic View screen", () => {
  test("opens from the Views tree with the transport, the outline, the chart and the summary", async ({ page }) => {
    await page.goto("./#/view/c2");
    await settled(page);
    await page.getByRole("button", { name: "Views" }).click();
    const tree = page.getByRole("dialog", { name: "Views" });
    await tree.getByRole("button", { name: "Expand Dynamic Views" }).click();
    await tree.getByRole("button", { name: "Place order (full)" }).click();
    await settled(page);

    expect(hash(page)).toBe(FULL);
    await expect(transport(page)).toContainText("46 Steps");
    await expect(page.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(46);
    await expect(page.locator("[data-step-edge]")).toHaveCount(46);
    await expect(page.locator("[data-participant]")).toHaveCount(16);
    await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText("Place order (full)");
    await expect(detail(page)).toContainText("Every Service in a real checkout.");
    await expect(detail(page).getByRole("list", { name: "Legend" })).toContainText("Return");
  });

  test("draws sync solid with a filled head, async solid with an open head and returns dashed", async ({ page }) => {
    await openDynamic(page, FULL);
    const style = (key: string) =>
      arrow(page, key).evaluate((g) => {
        const line = g.querySelector("path.arc-step-line")!;
        return { dash: getComputedStyle(line).strokeDasharray, head: line.getAttribute("marker-end") };
      });

    expect(await style("2")).toEqual({ dash: "none", head: "url(#arc-head-filled)" });
    expect(await style("46")).toEqual({ dash: "none", head: "url(#arc-head-open)" });
    expect((await style("4")).dash).not.toBe("none");
    expect((await style("4")).head).toBe("url(#arc-head-open)");
    await expect(arrow(page, "37")).toContainText("via Event Bus · payment-events");
  });

  test("selection is shared by the outline, the chart, the progress bar and the detail", async ({ page }) => {
    await openDynamic(page, FULL);

    await outlineRow(page, 5).click();
    await expectSelected(page, 5);
    await arrow(page, "7").locator(".arc-step-hit").dispatchEvent("click");
    await expectSelected(page, 7);
    await tick(page, 12).click();
    await expectSelected(page, 12);
    await expect(detail(page)).toContainText("All in stock");
    await expect(detail(page)).toContainText("Inventory API");
  });

  test("plays a Step about every 1.4 s, fading later Steps, and stops at the end", async ({ page }) => {
    await page.clock.install();
    await openDynamic(page, PAY);
    const play = transport(page).getByRole("button", { name: "Play" });

    await play.click();
    await expectSelected(page, 1);
    await expect(arrow(page, "3")).toHaveAttribute("data-later", "true");
    await page.clock.runFor(1400);
    await expectSelected(page, 2);
    await page.clock.runFor(2800);
    await expectSelected(page, 4);
    await expect(transport(page).getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.locator("[data-step-edge][data-later=true]")).toHaveCount(0);

    await transport(page).getByRole("button", { name: "First Step" }).click();
    await expectSelected(page, 1);
    await transport(page).getByRole("button", { name: "Play" }).click();
    await page.clock.runFor(1400);
    await transport(page).getByRole("button", { name: "Pause" }).click();
    await page.clock.runFor(5000);
    await expectSelected(page, 2);
  });

  test("keys: J and ↓ step forward, K and ↑ back, Space plays and pauses, Esc clears", async ({ page }) => {
    await page.clock.install();
    await openDynamic(page, FULL);

    await page.keyboard.press("j");
    await expectSelected(page, 1);
    await page.keyboard.press("j");
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, 3);
    await page.keyboard.press("k");
    await expectSelected(page, 2);
    await page.keyboard.press("ArrowUp");
    await expectSelected(page, 1);

    await page.keyboard.press(" ");
    await expect(transport(page).getByRole("button", { name: "Pause" })).toBeVisible();
    await page.clock.runFor(1400);
    await expectSelected(page, 2);
    await page.keyboard.press(" ");
    await expect(transport(page).getByRole("button", { name: "Play" })).toBeVisible();

    await page.keyboard.press("Escape");
    expect(hash(page)).toBe(FULL);
    await expect(page.locator("[data-step-edge][data-selected=true]")).toHaveCount(0);
    await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText("Place order (full)");
  });

  test("Show brokers splits each event Step into legs na and nb through the broker, sharing Step n", async ({ page }) => {
    await openDynamic(page, FULL);
    await page.getByRole("checkbox", { name: "Show brokers" }).check();
    await settled(page);

    expect(hash(page)).toBe(`${FULL}?brokers=1`);
    await expect(page.locator("[data-participant]")).toHaveCount(17);
    await expect(page.locator('[data-participant="platform:event-bus"]')).toHaveCount(1);
    await expect(arrow(page, "37")).toHaveCount(0);
    for (const key of ["37a", "37b", "42a", "42b"]) await expect(arrow(page, key)).toHaveCount(1);
    await expect(page.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(46);

    await arrow(page, "37b").locator(".arc-step-hit").dispatchEvent("click");
    expect(hash(page)).toContain("step=37");
    await expect(arrow(page, "37a")).toHaveAttribute("data-selected", "true");
    await expect(arrow(page, "37b")).toHaveAttribute("data-selected", "true");
    await expect(outlineRow(page, 37)).toHaveAttribute("aria-current", "step");
    await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText("Step 37");
  });

  test("the Step detail opens the Generated Views holding its Relationship, most specific first, and the other Dynamic Views using it", async ({ page }) => {
    await openDynamic(page, `${FULL}?step=27`);
    const views = detail(page).getByRole("list", { name: "Open in" }).getByRole("button");

    await expect(views).toHaveText(["Checkout (C2)", "Payments (C2)", "C2 Landscape", "C1 Landscape"]);
    await expect(detail(page).getByRole("list", { name: "Also in" }).getByRole("button")).toHaveText(["Pay for an order"]);

    await views.filter({ hasText: "Payments (C2)" }).click();
    await settled(page);
    // Both ends show: the consumer's System is opened, and the consumer is selected.
    expect(hash(page)).toBe("#/view/c2/payments:payments?open=shop:checkout&sel=shop:checkout-api");
    await page.goBack();
    await settled(page);
    await detail(page).getByRole("button", { name: "Pay for an order" }).click();
    await settled(page);
    expect(hash(page)).toBe(PAY);
  });

  test("Sequence | Graph shows the same Steps as a numbered graph with returns folded onto their call, keeping the selection", async ({ page }) => {
    await openDynamic(page, `${PAY}?step=4`);
    await page.getByRole("group", { name: "Chart" }).getByRole("button", { name: "Graph" }).click();
    await settled(page);

    expect(hash(page)).toBe(`${PAY}?step=4&mode=graph`);
    await expect(page.locator("[data-graph-node]")).toHaveCount(3);
    await expect(page.locator("path[data-edge-from]")).toHaveCount(2);
    await expect(page.locator("[data-graph-step]")).toHaveText(["1", "4", "2", "3"]);
    await expect(page.locator('[data-graph-step="4"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-graph-step="2"]').click();
    expect(hash(page)).toContain("step=2");
    await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText("Step 2");
  });

  test("keeps the headers pinned while scrolling and never zooms below 85%", async ({ page }) => {
    await openDynamic(page, FULL);
    const chart = page.locator(".arc-seq");
    const header = page.locator('[data-header="shop:checkout-api"]');
    const top = (await chart.boundingBox())!.y;

    await chart.hover();
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    await expect(async () => expect(Math.abs((await header.boundingBox())!.y - top)).toBeLessThan(2)).toPass();
    expect(await outlineRow(page, 1).isVisible()).toBe(true);

    await page.keyboard.down("Control");
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    await page.keyboard.up("Control");
    const zoom = await page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(zoom).toBeGreaterThanOrEqual(0.85);

    // Sample the zoom on every frame while Fit animates: the camera must not dip below the floor mid-flight either.
    const sampling = page.locator(".react-flow__viewport").evaluate(
      (el) =>
        new Promise<number>((resolve) => {
          let least = Infinity;
          const start = performance.now();
          const frame = () => {
            least = Math.min(least, new DOMMatrix(getComputedStyle(el).transform).a);
            if (performance.now() - start < 600) requestAnimationFrame(frame);
            else resolve(least);
          };
          frame();
        }),
    );
    await page.getByRole("button", { name: "Fit whole chart" }).click();
    expect(await sampling).toBeGreaterThanOrEqual(0.85);
  });
});
