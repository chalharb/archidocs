import { expect, type Page } from "@playwright/test";
import type { Layout } from "../src/render/index.ts";

/** A node on the canvas, by Element id. */
export const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);

/** The ids of every node on the canvas, sorted. */
export async function nodeIds(page: Page): Promise<string[]> {
  const ids = await page.locator("[data-node]").evaluateAll((els) => els.map((e) => e.getAttribute("data-node")!));
  return ids.sort();
}

/** Opens a place in the viewer and waits until its View is laid out on the canvas. */
export async function open(page: Page, hash: string) {
  await page.goto(`./${hash}`);
  await settled(page);
}

/** Waits until the canvas shows a finished layout of the current URL's View. */
export async function settled(page: Page) {
  await expect(page.locator("[data-canvas]")).toHaveAttribute("data-state", "ready");
}

/** The current place's hash. */
export const hash = (page: Page) => new URL(page.url()).hash;

/**
 * The canvas as drawn, in screen pixels: each node's box (with its parent)
 * and each edge's polyline, read from the rendered DOM.
 */
export async function renderedGeometry(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-node]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.node!, parent: el.dataset.parent || null, x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const edges = [...document.querySelectorAll<SVGPathElement>("path[data-edge-from]")].map((path) => {
      const m = path.getScreenCTM()!;
      const numbers = (path.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)!.map(Number);
      const points = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const p = new DOMPoint(numbers[i], numbers[i + 1]).matrixTransform(m);
        points.push({ x: p.x, y: p.y });
      }
      return { from: path.dataset.edgeFrom!, to: path.dataset.edgeTo!, points };
    });
    return { direction: "LR" as const, width: 0, height: 0, nodes, edges };
  });
}
