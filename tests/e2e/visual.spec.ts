/**
 * Visual regression (LAYER-07, VR-01..09), styled per ADD-004.
 * Fixed 1280x800 viewport at scale 1, bundled Geist fonts, deterministic
 * fixtures and positions, and animations disabled (ADD-005). Baselines are
 * per platform; regenerate with `pnpm test:e2e --update-snapshots` after an
 * intentional visual change.
 */
import { expect, test, type Page } from "@playwright/test";
import { diagramUrl, waitForDiagram } from "./helpers";

async function snapshot(page: Page, workspace: string, diagram: string, name: string) {
  await page.goto(diagramUrl(workspace, diagram));
  await waitForDiagram(page, { edges: diagram !== "broken" });
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });
}

test.describe("visual regression", () => {
  test("VR-01 C4 system context", async ({ page }) => {
    await snapshot(page, "acme", "system-context", "vr-01-c4-context");
  });
  test("VR-02 C4 container", async ({ page }) => {
    await snapshot(page, "acme", "containers", "vr-02-c4-container");
  });
  test("VR-03 C4 component", async ({ page }) => {
    await snapshot(page, "acme", "payments-api-components", "vr-03-c4-component");
  });
  test("VR-04 network topology", async ({ page }) => {
    await snapshot(page, "acme", "network-topology", "vr-04-network");
  });
  test("VR-05 deployment architecture", async ({ page }) => {
    await snapshot(page, "acme", "deployment", "vr-05-deployment");
  });
  test("VR-06 alternative edge styles and every shape", async ({ page }) => {
    await snapshot(page, "visual", "edge-styles", "vr-06-edge-styles");
  });
  test("VR-07 nested boundaries", async ({ page }) => {
    await snapshot(page, "visual", "nested", "vr-07-nested-boundaries");
  });
  test("VR-08 large diagram", async ({ page }) => {
    await snapshot(page, "large", "bench", "vr-08-large");
  });
  test("VR-09 error and diagnostic states", async ({ page }) => {
    await snapshot(page, "visual", "broken", "vr-09-diagnostics");
  });
  test("ADD-005: an animated edge is static under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(diagramUrl("visual", "edge-styles"));
    await waitForDiagram(page);
    await expect(page.getByTestId("diagram-canvas")).toHaveScreenshot("add-005-reduced-motion.png");
  });
});
