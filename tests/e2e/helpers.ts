import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Playwright runs from the repository root (and loads specs as CommonJS). */
export const ROOT = process.cwd();
export const SAMPLE_DIR = path.join(ROOT, "examples/sample-workspace");
export const SCRATCH_DIR = path.join(ROOT, ".e2e-workspaces/scratch");

/** Restore the scratch workspace to a copy of the sample and make the server reload it. */
export async function resetScratch(request: APIRequestContext, baseURL: string): Promise<void> {
  const layouts = (await readdir(path.join(SCRATCH_DIR, "diagrams"))).filter((f) =>
    f.endsWith(".layout.yaml"),
  );
  await Promise.all(layouts.map((f) => rm(path.join(SCRATCH_DIR, "diagrams", f))));
  await rm(path.join(SCRATCH_DIR, ".archidoc"), { recursive: true, force: true });
  await cp(SAMPLE_DIR, SCRATCH_DIR, { recursive: true });
  const res = await request.post("/api/workspaces/scratch/reload", {
    headers: { origin: baseURL, "content-type": "application/json" },
  });
  expect(res.ok()).toBe(true);
  await waitForQuiet(request, "scratch");
}

/** Wait until the watcher has processed our file changes (version stable for a while). */
export async function waitForQuiet(request: APIRequestContext, workspace: string, quietMs = 800) {
  const version = async () => {
    const res = await request.get("/api/workspaces");
    const body = (await res.json()) as { workspaces: Array<{ key: string; version: number }> };
    return body.workspaces.find((w) => w.key === workspace)!.version;
  };
  let last = await version();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, quietMs));
    const now = await version();
    if (now === last) return;
    last = now;
  }
}

export function diagramUrl(workspace: string, diagram: string) {
  return `/workspaces/${workspace}/diagrams/${diagram}`;
}

/** Wait until the diagram has rendered its nodes and edges and fonts are ready. */
export async function waitForDiagram(page: Page, opts: { edges?: boolean } = {}): Promise<void> {
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  if (opts.edges !== false) await expect(page.locator(".react-flow__edge").first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  // Let fitView and edge measurement settle.
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".react-flow__node")];
    return nodes.length > 0 && nodes.every((n) => getComputedStyle(n).visibility !== "hidden");
  });
  await page.waitForTimeout(250);
}

export function node(page: Page, id: string) {
  return page.locator(`.react-flow__node[data-id="${id}"]`);
}

export async function centerOf(page: Page, id: string) {
  const box = (await node(page, id).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

export async function drag(page: Page, id: string, dx: number, dy: number) {
  const c = await centerOf(page, id);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx / 2, c.y + dy / 2, { steps: 5 });
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 5 });
  await page.mouse.up();
}

interface ApiDiagramView {
  layout: {
    positions: Record<
      string,
      { x: number; y: number; width: number; height: number; source: string }
    >;
    edgeTypes: Record<string, string>;
    edgeAnimated: Record<string, boolean>;
  };
  settings: { settings: Record<string, unknown> };
  persistence: { revision: string | null };
}

export async function diagramView(
  request: APIRequestContext,
  workspace: string,
  diagram: string,
): Promise<ApiDiagramView> {
  const res = await request.get(`/api/workspaces/${workspace}/diagrams/${diagram}`);
  expect(res.ok()).toBe(true);
  return res.json();
}

export async function save(page: Page) {
  await page.getByRole("button", { name: "Save layout" }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
}
