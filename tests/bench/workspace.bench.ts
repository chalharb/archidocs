import { afterAll, beforeAll, bench, describe } from "vitest";
import { buildGraphIndex } from "@/domain/graph-index";
import { resolveDiagram } from "@/domain/diagram-resolve";
import { resolveLayout } from "@/domain/layout/positions";
import { APP_DEFAULT_LAYOUT_SETTINGS } from "@/domain/layout/settings";
import { WorkspaceRepository } from "@/server/workspace/repository";
import { tempDir, type TempDir } from "../helpers/tmp";
import { writeBenchWorkspace } from "./fixture";

let ws: TempDir;
let repo: WorkspaceRepository;

beforeAll(async () => {
  ws = await tempDir();
  await writeBenchWorkspace(ws.dir);
  repo = await WorkspaceRepository.open("bench", ws.dir);
});
afterAll(async () => {
  await repo.close();
  await ws.cleanup();
});

describe("workspace loading (BENCH-01, PERF-02)", () => {
  bench("cold load: 100 entities", async () => {
    const r = await WorkspaceRepository.open("cold", ws.dir);
    await r.close();
  });
  bench("warm reload: 100 entities, unchanged", async () => {
    await repo.reload();
  });
});

describe("graph and diagram resolution (BENCH-02, PERF-04)", () => {
  bench("build graph index", () => {
    buildGraphIndex(repo.snapshot().model);
  });
  bench("resolve 100 nodes / 150 edges", () => {
    resolveDiagram(repo.snapshot().model, "bench");
  });
});

describe("layout with manual overrides (PERF-03)", () => {
  bench("resolve layout: 50 manual + 50 generated", () => {
    const model = repo.snapshot().model;
    resolveLayout({
      diagram: resolveDiagram(model, "bench").diagram!,
      layout: model.layouts.bench!,
      settings: APP_DEFAULT_LAYOUT_SETTINGS,
    });
  });
  bench("full diagram view", async () => {
    await repo.diagramView("bench");
  });
});

describe("persistence (BENCH-05)", () => {
  let i = 0;
  bench("save layout YAML", async () => {
    const view = (await repo.diagramView("bench"))!;
    await repo.saveLayout(
      "bench",
      { nodes: { e0000: { x: i++, y: 0 } } },
      view.persistence.revision,
    );
  });
});
