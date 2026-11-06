/**
 * Performance budgets (PRD §8, PERF-04). Each operation's median over several
 * runs must stay within the PRD target; a regression fails CI.
 */
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveDiagram } from "@/domain/diagram-resolve";
import { layoutAll } from "@/domain/layout/elk";
import { resolveLayout } from "@/domain/layout/positions";
import { APP_DEFAULT_LAYOUT_SETTINGS } from "@/domain/layout/settings";
import { WorkspaceRepository } from "@/server/workspace/repository";
import { benchFiles, WITH_MARKDOWN, writeBenchWorkspace } from "../bench/fixture";
import { tempDir, type TempDir } from "../helpers/tmp";

async function median(runs: number, fn: () => unknown | Promise<unknown>): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

let ws: TempDir;
let mdWs: TempDir;
let repo: WorkspaceRepository;

beforeAll(async () => {
  ws = await tempDir();
  await writeBenchWorkspace(ws.dir);
  mdWs = await tempDir();
  await writeBenchWorkspace(mdWs.dir, WITH_MARKDOWN);
  repo = await WorkspaceRepository.open("perf", ws.dir);
});
afterAll(async () => {
  await repo.close();
  await ws.cleanup();
  await mdWs.cleanup();
});

describe("benchmark fixture (PERF-01)", () => {
  it("is deterministic and valid at the specified size", () => {
    expect(JSON.stringify(benchFiles())).toBe(JSON.stringify(benchFiles()));
    const snap = repo.snapshot();
    expect(snap.diagnostics).toEqual([]);
    expect(Object.keys(snap.model.entities)).toHaveLength(100);
    expect(Object.keys(snap.model.relationships)).toHaveLength(150);
    const d = resolveDiagram(snap.model, "bench").diagram!;
    expect([d.nodes.length, d.edges.length]).toEqual([100, 150]);
  });

  it("is deterministic and valid with 200 Markdown resources (BENCH-07)", async () => {
    expect(JSON.stringify(benchFiles(WITH_MARKDOWN))).toBe(
      JSON.stringify(benchFiles(WITH_MARKDOWN)),
    );
    const md = await WorkspaceRepository.open("perf-md", mdWs.dir);
    try {
      const snap = md.snapshot();
      expect(snap.diagnostics).toEqual([]);
      expect(Object.keys(snap.model.entities)).toHaveLength(100);
      const docs = Object.values(snap.model.documents);
      const adrs = Object.values(snap.model.decisions);
      expect([docs.length, adrs.length]).toEqual([120, 80]);
      expect(adrs.filter((a) => a.supersedes?.length).length).toBeGreaterThan(0);
      expect(adrs.filter((a) => a.status === "superseded").length).toBeGreaterThan(0);
    } finally {
      await md.close();
    }
  });
});

describe("performance budgets", () => {
  it("BENCH-01: loads 100 entities in under 1 s (cold)", async () => {
    const ms = await median(5, async () =>
      (await WorkspaceRepository.open("cold", ws.dir)).close(),
    );
    expect(ms).toBeLessThan(1000);
  });

  it("BENCH-07: loads 100 entities and 200 Markdown resources in under 1.5 s (cold)", async () => {
    const ms = await median(5, async () =>
      (await WorkspaceRepository.open("cold-md", mdWs.dir)).close(),
    );
    expect(ms).toBeLessThan(1500);
  });

  it("BENCH-02: resolves 100 nodes and 150 edges in under 200 ms", async () => {
    const model = repo.snapshot().model;
    const ms = await median(20, () => resolveDiagram(model, "bench"));
    expect(ms).toBeLessThan(200);
  });

  it("PERF-03: resolves a layout with 50 manual overrides in under 200 ms", async () => {
    const model = repo.snapshot().model;
    const diagram = resolveDiagram(model, "bench").diagram!;
    const ms = await median(20, () =>
      resolveLayout({
        diagram,
        layout: model.layouts.bench!,
        settings: APP_DEFAULT_LAYOUT_SETTINGS,
      }),
    );
    expect(ms).toBeLessThan(200);
  });

  it("BENCH-05: saves layout YAML in under 500 ms", async () => {
    let x = 0;
    const ms = await median(5, async () => {
      const view = (await repo.diagramView("bench"))!;
      await repo.saveLayout(
        "bench",
        { nodes: { e0000: { x: x++, y: 0 } } },
        view.persistence.revision,
      );
    });
    expect(ms).toBeLessThan(500);
  });

  it("BENCH-03: auto-lays out a medium diagram with ELK in under 2 s", async () => {
    const diagram = resolveDiagram(repo.snapshot().model, "bench").diagram!;
    const ms = await median(5, () =>
      layoutAll({
        nodes: diagram.nodes,
        edges: diagram.edges,
        settings: APP_DEFAULT_LAYOUT_SETTINGS,
      }),
    );
    expect(ms).toBeLessThan(2000);
  });
});
