/**
 * Browser performance budgets on the medium benchmark diagram (100 nodes,
 * 150 edges): BENCH-04 dragging, BENCH-06 export, and PERF-04 rendering.
 * Measurements are logged so they can be recorded in docs/performance.md.
 */
import { expect, test, type Page } from "@playwright/test";
import { centerOf, diagramUrl, waitForDiagram } from "./helpers";

/** Drag `id` around in small steps while recording frame intervals. */
async function dragFrames(page: Page, id: string) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    const tick = (t: number) => {
      w.__frames.push(t);
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const c = await centerOf(page, id);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const start = Date.now();
  for (let i = 1; Date.now() - start < 2000; i++) {
    await page.mouse.move(c.x + 150 * Math.sin(i / 8), c.y + 80 * Math.cos(i / 8));
  }
  await page.mouse.up();
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
  const intervals = frames.slice(1).map((t, i) => t - frames[i]!);
  intervals.sort((a, b) => a - b);
  const fps = (frames.length - 1) / ((frames.at(-1)! - frames[0]!) / 1000);
  return {
    fps,
    median: intervals[Math.floor(intervals.length / 2)]!,
    p95: intervals[Math.floor(intervals.length * 0.95)]!,
  };
}

test.describe("performance budgets (medium diagram)", () => {
  test.describe.configure({ mode: "serial" });

  test("PERF-04: renders 100 nodes and 150 edges promptly", async ({ page }) => {
    const start = Date.now();
    await page.goto(diagramUrl("large", "bench"));
    await waitForDiagram(page);
    const ms = Date.now() - start;
    await expect(page.locator(".react-flow__node")).toHaveCount(100);
    await expect(page.locator(".react-flow__edge")).toHaveCount(150);
    console.log(`[perf] initial render: ${ms} ms`);
    expect(ms).toBeLessThan(3000);
  });

  test("BENCH-04: drags nodes at about 60 FPS, with and without animated edges", async ({
    page,
  }) => {
    await page.goto(diagramUrl("large", "bench"));
    await waitForDiagram(page);
    const still = await dragFrames(page, "e0042");
    console.log(
      `[perf] drag: ${still.fps.toFixed(1)} fps, median ${still.median.toFixed(1)} ms, p95 ${still.p95.toFixed(1)} ms`,
    );
    expect(still.median).toBeLessThan(20); // ~60 FPS; 20 ms allows for timer jitter
    await expect(page.getByRole("status")).toHaveText("Unsaved changes"); // the node really moved

    // ADD-005: animated edges must not push dragging below the target.
    await page.getByLabel("Animate edges").check();
    const animated = await dragFrames(page, "e0042");
    console.log(
      `[perf] drag (animated edges): ${animated.fps.toFixed(1)} fps, median ${animated.median.toFixed(1)} ms, p95 ${animated.p95.toFixed(1)} ms`,
    );
    expect(animated.median).toBeLessThan(20);
  });

  test("BENCH-06: exports the medium diagram in under 5 s", async ({ page }) => {
    await page.goto(diagramUrl("large", "bench"));
    await waitForDiagram(page);
    for (const format of ["PNG", "SVG"]) {
      const start = Date.now();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: format }).click(),
      ]);
      await download.path();
      const ms = Date.now() - start;
      console.log(`[perf] export ${format}: ${ms} ms`);
      expect(ms).toBeLessThan(5000);
    }
  });
});
