/**
 * Phase 1 E2E workflows (PRD §7, E2E-01..05) plus SCOPE-01 and LAYOUT-25
 * reduced motion. Tests that change files use the scratch workspace and run
 * serially; each starts from a fresh copy of the sample.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  SCRATCH_DIR,
  centerOf,
  diagramUrl,
  diagramView,
  drag,
  node,
  resetScratch,
  save,
  waitForDiagram,
} from "./helpers";

test.describe("read-only viewing", () => {
  test("E2E-01: loads a YAML workspace and renders a diagram with canonical references", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Payments — Containers" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payments — Containers");
    await waitForDiagram(page);
    await expect(page.locator(".react-flow__node")).toHaveCount(6);
    await expect(page.locator(".react-flow__edge")).toHaveCount(5);
    // DIAG-08: rendered nodes keep their canonical entity reference.
    await expect(page.getByTestId("node-payments-api")).toHaveAttribute(
      "data-entity-id",
      "payments-api",
    );
    // DIAG-11: styles resolved through type inheritance and overrides.
    await expect(page.getByTestId("node-ledger-db")).toHaveAttribute("data-shape", "cylinder");
    await expect(page.getByTestId("node-web-shop")).toHaveAttribute("data-shape", "browser");
    await expect(page.getByTestId("node-customer")).toHaveAttribute("data-shape", "person");
    // DIAG-12: the view has no layout controls; diagnostics collapse to an indicator.
    await expect(page.getByRole("button", { name: "No problems" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save layout" })).toHaveCount(0);
    await expect(page.getByLabel("Direction")).toHaveCount(0);
  });

  test("DIAG-09: renders several view instances of one entity", async ({ page }) => {
    await page.goto(diagramUrl("acme", "deployment"));
    await waitForDiagram(page);
    await expect(page.getByTestId("node-payments-api-a")).toHaveAttribute(
      "data-entity-id",
      "payments-api",
    );
    await expect(page.getByTestId("node-payments-api-b")).toHaveAttribute(
      "data-entity-id",
      "payments-api",
    );
  });

  test("LAYOUT-14: draws nodes inside their boundary", async ({ page }) => {
    await page.goto(diagramUrl("acme", "network-topology"));
    await waitForDiagram(page);
    const dmz = (await node(page, "dmz").boundingBox())!;
    const lb = (await node(page, "edge-lb").boundingBox())!;
    expect(lb.x).toBeGreaterThan(dmz.x);
    expect(lb.y).toBeGreaterThan(dmz.y);
    expect(lb.x + lb.width).toBeLessThan(dmz.x + dmz.width);
    expect(lb.y + lb.height).toBeLessThan(dmz.y + dmz.height);
  });

  test("DIAG-07: inspects a node and navigates to another diagram that shows it", async ({
    page,
  }) => {
    await page.goto(diagramUrl("acme", "containers"));
    await waitForDiagram(page);
    await node(page, "payments-api").click();
    const details = page.getByRole("complementary", { name: "Diagram details" });
    await expect(details.getByRole("heading", { name: "Payments API" })).toBeVisible();
    await expect(details.getByText("Go", { exact: true })).toBeVisible();
    const related = details.getByRole("list", { name: "Related diagrams" });
    await related.getByRole("link", { name: "Production Deployment" }).click();
    await expect(page).toHaveURL(/diagrams\/deployment\?focus=payments-api/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Production Deployment");
    await waitForDiagram(page);
    await expect(node(page, "payments-api-a")).toHaveClass(/selected/);
  });

  test("DIAG-10 / LAYOUT-13: shows diagnostics and orphaned layout overrides", async ({ page }) => {
    await page.goto(diagramUrl("visual", "broken"));
    await waitForDiagram(page, { edges: false });
    const indicator = page.getByRole("button", { name: /^\d+ problems?$/ });
    await expect(indicator).toHaveAttribute("aria-expanded", "false");
    await indicator.click();
    const details = page.getByRole("complementary", { name: "Diagram details" });
    await expect(details.getByText("Orphaned layout overrides")).toBeVisible();
    await expect(details.getByText(/no longer in this diagram/)).toContainText("'removed-node'");
    await expect(details.getByText(/unknown entity 'does-not-exist'/)).toBeVisible();
  });

  test("LAYOUT-10: minimap, zoom, pan and fit to view", async ({ page }) => {
    await page.goto(diagramUrl("acme", "containers"));
    await waitForDiagram(page);
    await expect(page.getByRole("img", { name: "Diagram overview" })).toBeVisible();
    const viewport = page.locator(".react-flow__viewport");
    const transform = () => viewport.evaluate((el) => (el as HTMLElement).style.transform);
    const scale = async () => Number((await transform()).match(/scale\(([\d.]+)\)/)![1]);
    const fitted = await transform();

    const before = await scale();
    await page.getByRole("button", { name: "Zoom In" }).click();
    await expect.poll(scale).toBeGreaterThan(before);

    const pane = (await page.locator(".react-flow__pane").boundingBox())!;
    const zoomed = await transform();
    // Start on empty canvas along the top edge (controls and minimap sit at the bottom).
    await page.mouse.move(pane.x + pane.width / 2, pane.y + 8);
    await page.mouse.down();
    await page.mouse.move(pane.x + pane.width / 2 + 100, pane.y + 60, { steps: 5 });
    await page.mouse.up();
    await expect.poll(transform).not.toBe(zoomed);

    await page.getByRole("button", { name: "Fit to view" }).click();
    await expect.poll(transform).toBe(fitted);
  });

  test("SCOPE-01: the canvas cannot create or delete entities or relationships", async ({
    page,
  }) => {
    await page.goto(diagramUrl("acme", "containers"));
    await waitForDiagram(page);
    await node(page, "payments-api").click();
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await expect(page.locator(".react-flow__node")).toHaveCount(6);
    await expect(page.locator(".react-flow__edge")).toHaveCount(5);
    await expect(page.locator(".react-flow__handle.connectable")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add|delete|remove|new/i })).toHaveCount(0);
    // DIAG-12: nodes can't be moved in the view.
    const before = (await node(page, "payments-api").boundingBox())!;
    await drag(page, "payments-api", 0, 120);
    const after = (await node(page, "payments-api").boundingBox())!;
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  for (const mode of ["view", "edit"] as const) {
    test(`diagram ${mode} page has no automatically detectable accessibility violations`, async ({
      page,
    }) => {
      await page.goto(diagramUrl("acme", "containers", mode));
      await waitForDiagram(page);
      await node(page, "payments-api").click(); // include the details panel
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("E2E-05: exports PNG and SVG of the whole diagram, statically", async ({ page }) => {
    await page.goto(diagramUrl("visual", "edge-styles"));
    await waitForDiagram(page);
    await expect(page.getByTestId("edge-flow-e-animated")).toBeAttached();

    const [png] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "PNG" }).click(),
    ]);
    expect(png.suggestedFilename()).toBe("edge-styles.png");
    const pngBytes = await readFile((await png.path())!);
    expect(pngBytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const width = pngBytes.readUInt32BE(16);
    const height = pngBytes.readUInt32BE(20);
    // Whole diagram (1280 x 780 of nodes) plus a 40px margin, at 2x.
    expect(width).toBe((1280 + 80) * 2);
    expect(height).toBe((780 + 80) * 2);

    const [svg] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "SVG" }).click(),
    ]);
    expect(svg.suggestedFilename()).toBe("edge-styles.svg");
    const svgText = await readFile((await svg.path())!, "utf8");
    expect(svgText.startsWith("<svg")).toBe(true);
    expect(svgText).toContain('width="1360"');
    for (const label of ["Rectangle", "Cylinder", "Queue", "bezier"])
      expect(svgText).toContain(label);
    // LAYOUT-25: exports never contain the flow animation.
    // Styles are inlined into SVG content, so shapes and edges keep their colours.
    expect(svgText).toMatch(/class="fill"[^>]*style="[^"]*fill: rgb\(/);
    expect(svgText).toMatch(/arch-edge-path"[^>]*style="[^"]*stroke-dasharray: 2px, 5px/);
    expect(svgText).not.toContain("arch-edge-flow");
  });
});

test.describe("LAYOUT-25 animated edges", () => {
  test("animate from source to target by default motion settings", async ({ page }) => {
    await page.goto(diagramUrl("visual", "edge-styles"));
    await waitForDiagram(page);
    const flow = page.getByTestId("edge-flow-e-animated");
    // A horizontal path has an empty bounding box, so check the computed style.
    expect(await flow.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
    expect(await flow.evaluate((el) => getComputedStyle(el).animationName)).toBe("arch-edge-flow");
    await expect(page.getByTestId("edge-flow-e-straight")).toHaveCount(0);
  });

  test("render static when the user prefers reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(diagramUrl("visual", "edge-styles"));
    await waitForDiagram(page);
    const flow = page.getByTestId("edge-flow-e-animated");
    await expect(flow).toBeAttached();
    expect(await flow.evaluate((el) => getComputedStyle(el).display)).toBe("none");
  });
});

test.describe("editing the scratch workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ request, baseURL }) => {
    await resetScratch(request, baseURL!);
  });

  test("E2E-02: drag and align nodes, save, reload and verify positions", async ({
    page,
    request,
  }) => {
    await page.goto(diagramUrl("scratch", "containers", "edit"));
    await waitForDiagram(page);
    const before = await diagramView(request, "scratch", "containers");
    expect(before.persistence.revision).toBeNull();

    await drag(page, "customer", 0, 120);
    await expect(page.getByRole("status")).toHaveText("Unsaved changes");

    // Multi-select and align tops (LAYOUT-02).
    await node(page, "payments-api").click();
    await node(page, "card-network").click({ modifiers: ["ControlOrMeta"] });
    await page.getByRole("button", { name: "Align top" }).click();
    const [a, b] = await Promise.all([
      centerOf(page, "payments-api"),
      centerOf(page, "card-network"),
    ]);
    expect(Math.abs(a.box.y - b.box.y)).toBeLessThan(1);

    // Undo and redo (LAYOUT-09).
    await page.getByRole("button", { name: "Undo" }).click();
    const undone = await centerOf(page, "card-network");
    expect(Math.abs(undone.box.y - a.box.y)).toBeGreaterThan(1);
    await page.getByRole("button", { name: "Redo" }).click();
    expect(Math.abs((await centerOf(page, "card-network")).box.y - a.box.y)).toBeLessThan(1);

    await save(page);
    const file = await readFile(path.join(SCRATCH_DIR, "diagrams/containers.layout.yaml"), "utf8");
    expect(file).toContain("kind: DiagramLayout");
    expect(file).toMatch(/customer:\n\s+x: -?\d+\n\s+y: -?\d+/);

    const saved = await diagramView(request, "scratch", "containers");
    const p = saved.layout.positions;
    expect(p.customer!.source).toBe("manual");
    expect(p.customer!.y).toBeGreaterThan(before.layout.positions.customer!.y);
    expect(p.customer!.y % 20).toBe(0); // LAYOUT-03: snapped to the 20px grid
    expect(p["payments-api"]!.y).toBe(p["card-network"]!.y);

    // Canonical files untouched (LAYOUT-22).
    expect(
      await readFile(path.join(SCRATCH_DIR, "diagrams/containers.yaml"), "utf8"),
    ).not.toContain("x:");

    await page.reload();
    await waitForDiagram(page);
    await expect(page.getByRole("status")).toHaveText("All changes saved");
    const after = await diagramView(request, "scratch", "containers");
    expect(after.layout.positions).toEqual(saved.layout.positions);
    const [ra, rb] = await Promise.all([
      centerOf(page, "payments-api"),
      centerOf(page, "card-network"),
    ]);
    expect(Math.abs(ra.box.y - rb.box.y)).toBeLessThan(1);
  });

  test("E2E-03: change layout direction, spacing and edge styles", async ({ page, request }) => {
    await page.goto(diagramUrl("scratch", "containers", "edit"));
    await waitForDiagram(page);
    const details = page.getByRole("complementary", { name: "Diagram details" });
    const layout = details.getByRole("region", { name: "Layout" });

    await layout.getByLabel("Direction").selectOption("UP");
    const layer = layout.getByLabel("Layer spacing");
    await layer.fill("240");
    await layer.press("Enter");
    await details.getByRole("button", { name: "Re-layout all" }).click();
    await expect(page.getByRole("status")).toHaveText("Unsaved changes");

    // Diagram-wide edge style, then a per-edge override.
    await layout.getByLabel("Edge style").selectOption("bezier");
    await expect(page.getByTestId("edge-customer-shop")).toHaveAttribute(
      "data-edge-type",
      "bezier",
    );
    // Thin paths can have an empty box, so dispatch the click React Flow listens for.
    await page
      .locator('.react-flow__edge[data-id="shop-api"] .react-flow__edge-interaction')
      .dispatchEvent("click");
    const edgePanel = details.getByRole("region", { name: "calls" });
    await expect(edgePanel).toBeVisible();
    await edgePanel.getByLabel("Edge style").selectOption("step");
    await expect(page.getByTestId("edge-shop-api")).toHaveAttribute("data-edge-type", "step");
    await edgePanel.getByLabel("Animation").selectOption("on");
    await expect(page.getByTestId("edge-flow-shop-api")).toBeAttached();

    await save(page);
    const file = await readFile(path.join(SCRATCH_DIR, "diagrams/containers.layout.yaml"), "utf8");
    expect(file).toContain("direction: UP");
    expect(file).toContain("layerSpacing: 240");
    expect(file).toContain("edgeType: bezier");
    expect(file).toMatch(/shop-api:\n\s+type: step\n\s+animated: true/);

    const view = await diagramView(request, "scratch", "containers");
    const p = view.layout.positions;
    // UP: relationship targets are laid out above their sources.
    expect(p["web-shop"]!.y).toBeLessThan(p.customer!.y);
    expect(p["payments-api"]!.y).toBeLessThan(p["web-shop"]!.y);
    expect(p.customer!.y - (p["web-shop"]!.y + p["web-shop"]!.height)).toBeCloseTo(240, 0);
    expect(view.layout.edgeTypes).toMatchObject({ "customer-shop": "bezier", "shop-api": "step" });
    expect(view.layout.edgeAnimated["shop-api"]).toBe(true);
  });

  test("DIAG-12: view, edit, and Done with unsaved changes", async ({ page, request }) => {
    await page.goto(diagramUrl("scratch", "containers"));
    await waitForDiagram(page);
    await page.getByRole("link", { name: "Edit layout" }).click();
    await expect(page).toHaveURL(/\/diagrams\/containers\/edit$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Edit layout: Payments — Containers",
    );
    await waitForDiagram(page);

    // Leaving with unsaved changes asks first.
    await drag(page, "customer", 0, 120);
    await page.getByRole("button", { name: "Done" }).click();
    const prompt = page.getByRole("alertdialog");
    await expect(prompt).toContainText("Unsaved layout changes.");
    await prompt.getByRole("button", { name: "Keep editing" }).click();
    await expect(prompt).toHaveCount(0);
    await expect(page).toHaveURL(/\/edit$/);

    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Save and close" }).click();
    await expect(page).toHaveURL(/\/diagrams\/containers$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payments — Containers");
    const view = await diagramView(request, "scratch", "containers");
    expect(view.layout.positions.customer!.source).toBe("manual");

    // Without changes, Done returns straight away.
    await page.getByRole("link", { name: "Edit layout" }).click();
    await waitForDiagram(page);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/diagrams\/containers$/);
  });

  test("E2E-04: reloads when YAML changes externally, keeping unsaved edits", async ({ page }) => {
    await page.goto(diagramUrl("scratch", "containers", "edit"));
    await waitForDiagram(page);
    const systems = path.join(SCRATCH_DIR, "model/payments/systems.yaml");
    const original = await readFile(systems, "utf8");

    // A valid external change appears without reloading the page.
    await writeFile(systems, original.replace("name: Payments API", "name: Payments Gateway"));
    await expect(page.getByTestId("node-payments-api")).toContainText("Payments Gateway", {
      timeout: 15_000,
    });
    await expect(page.getByText(/reloaded because its files changed on disk/)).toBeVisible();

    // An invalid change keeps the last valid model and says so (RELI-02/04, DIAG-10).
    await writeFile(systems, `${original}\n  - { id: broken, name: [unclosed\n`);
    await expect(page.getByText("Showing the last valid model").last()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("node-payments-api")).toContainText("Payments Gateway");

    // Unsaved layout edits survive a later external change.
    await drag(page, "customer", 0, 120);
    await expect(page.getByRole("status")).toHaveText("Unsaved changes");
    const moved = (await node(page, "customer").boundingBox())!;
    await writeFile(systems, original);
    await expect(page.getByTestId("node-payments-api")).toContainText("Payments API", {
      timeout: 15_000,
    });
    await expect(page.getByText("Showing the last valid model")).toHaveCount(0);
    await expect(page.getByText(/unsaved layout changes were kept/)).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Unsaved changes");
    const kept = (await node(page, "customer").boundingBox())!;
    expect(Math.abs(kept.y - moved.y)).toBeLessThan(1);
  });
});
