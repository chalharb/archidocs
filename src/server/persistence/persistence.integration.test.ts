import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalize } from "@/domain/normalize";
import { parseResources } from "@/domain/parse";
import type { ArchitectureModel } from "@/domain/model";
import { CONTAINERS_LAYOUT, copySampleWorkspace, hashTree } from "../../../tests/helpers/workspace";
import type { TempDir } from "../../../tests/helpers/tmp";
import { nodeAtomicWriteOps } from "../fs/atomic-write";
import { WorkspaceRoot } from "../fs/workspace-root";
import { loadWorkspace } from "../workspace/loader";
import { assessDraft, DraftStore, draftPath, DRAFTS_DIR } from "./drafts";
import { layoutTarget, LayoutSaveError, prepareLayout, writeLayout } from "./layout-writer";
import { revisionOf } from "./revision";

let ws: TempDir;
let root: WorkspaceRoot;
let model: ArchitectureModel;
const MAX = 1024 * 1024;

beforeEach(async () => {
  // "containers" starts unsaved so the create-file paths are exercised.
  ws = await copySampleWorkspace({ without: [CONTAINERS_LAYOUT] });
  root = await WorkspaceRoot.open(ws.dir);
  model = (await loadWorkspace(root)).model;
});
afterEach(() => ws.cleanup());

const fileText = (rel: string) => readFile(path.join(ws.dir, rel), "utf8");
async function saveError(p: Promise<unknown>): Promise<LayoutSaveError> {
  try {
    await p;
  } catch (err) {
    return err as LayoutSaveError;
  }
  throw new Error("expected failure");
}

describe("revisionOf (RELI-06)", () => {
  it("is a stable content hash", () => {
    expect(revisionOf("a")).toBe(revisionOf("a"));
    expect(revisionOf("a")).not.toBe(revisionOf("b"));
    expect(revisionOf("")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("layoutTarget", () => {
  it("uses the existing layout file", () => {
    expect(layoutTarget(model, "system-context")).toEqual({
      path: "diagrams/system-context.layout.yaml",
      writable: true,
    });
  });

  it("defaults to <diagram-id>.layout.yaml next to the diagram file", () => {
    expect(layoutTarget(model, "containers")).toEqual({
      path: "diagrams/containers.layout.yaml",
      writable: true,
    });
  });

  it("handles diagrams at the workspace root", () => {
    const m = normalize(
      parseResources(
        "apiVersion: archdocs/v1\nkind: Diagram\nid: d\nname: D\ndiagramType: custom\nnodes: []\n",
        "d.yaml",
      ).resources,
    ).model;
    expect(layoutTarget(m, "d")!.path).toBe("d.layout.yaml");
  });

  it("refuses files shared with other resources (LAYOUT-23)", () => {
    const content =
      "apiVersion: archdocs/v1\nkind: Diagram\nid: d\nname: D\ndiagramType: custom\nnodes: []\n---\napiVersion: archdocs/v1\nkind: DiagramLayout\ndiagram: d\n";
    const m = normalize(parseResources(content, "both.yaml").resources).model;
    expect(layoutTarget(m, "d")).toMatchObject({ path: "both.yaml", writable: false });
  });

  it("returns null for unknown diagrams", () => {
    expect(layoutTarget(model, "nope")).toBeNull();
  });
});

describe("prepareLayout: validate before write (RELI-09)", () => {
  it("accepts a valid edit and serializes deterministically", () => {
    const { content, layout } = prepareLayout(model, "containers", {
      settings: { direction: "LEFT" },
      nodes: { "web-shop": { x: 1, y: 2 } },
      edges: { "shop-api": { type: "bezier" } },
    });
    expect(layout.nodes["web-shop"]).toEqual({ x: 1, y: 2 });
    expect(content).toContain("diagram: containers");
  });

  it.each([
    ["schema violation", { nodes: { "web-shop": { x: "1", y: 2 } } }, /nodes\.web-shop\.x/],
    ["unknown setting", { settings: { colour: "red" } }, /settings/],
    ["unknown node", { nodes: { ghost: { x: 1, y: 2 } } }, /nodes\.ghost: not a node/],
    ["unknown edge", { edges: { ghost: { type: "step" } } }, /edges\.ghost: not an edge/],
    ["out-of-range coordinate", { nodes: { "web-shop": { x: 1e9, y: 0 } } }, /x/],
  ])("rejects %s", (_name, edit, issue) => {
    const err = (() => {
      try {
        prepareLayout(model, "containers", edit as never);
      } catch (e) {
        return e as LayoutSaveError;
      }
    })()!;
    expect(err.code).toBe("INVALID");
    expect(err.details.issues!.join("\n")).toMatch(issue);
  });

  it("rejects unknown diagrams", () => {
    expect(() => prepareLayout(model, "nope", {})).toThrow(
      expect.objectContaining({ code: "DIAGRAM_NOT_FOUND" }),
    );
  });
});

describe("writeLayout (TEST-05)", () => {
  it("creates a new layout file when the base revision is null", async () => {
    const result = await writeLayout({
      root,
      model,
      diagramId: "containers",
      edit: { nodes: { "web-shop": { x: 10, y: 20 } } },
      baseRevision: null,
      maxBytes: MAX,
    });
    expect(result.path).toBe("diagrams/containers.layout.yaml");
    expect(await fileText(result.path)).toBe(result.content);
    expect(result.revision).toBe(revisionOf(result.content));
  });

  it("round-trips: what is written loads back as the same layout", async () => {
    const edit = {
      settings: { edgeType: "step" as const },
      nodes: { "web-shop": { x: 10.5, y: -20 } },
    };
    await writeLayout({
      root,
      model,
      diagramId: "containers",
      edit,
      baseRevision: null,
      maxBytes: MAX,
    });
    const reloaded = await loadWorkspace(root);
    expect(reloaded.diagnostics).toEqual([]);
    expect(reloaded.model.layouts.containers).toEqual({
      diagram: "containers",
      settings: edit.settings,
      nodes: edit.nodes,
      edges: {},
    });
  });

  it("overwrites when the base revision matches the file on disk", async () => {
    const current = await fileText("diagrams/system-context.layout.yaml");
    await writeLayout({
      root,
      model,
      diagramId: "system-context",
      edit: { nodes: { customer: { x: 5, y: 5 } } },
      baseRevision: revisionOf(current),
      maxBytes: MAX,
    });
    expect(await fileText("diagrams/system-context.layout.yaml")).toContain("x: 5");
  });

  it("refuses to overwrite an externally modified file (RELI-07)", async () => {
    const rel = "diagrams/system-context.layout.yaml";
    const base = revisionOf(await fileText(rel));
    const external = (await fileText(rel)).replace("x: 600", "x: 601");
    await writeFile(path.join(ws.dir, rel), external);
    const err = await saveError(
      writeLayout({
        root,
        model,
        diagramId: "system-context",
        edit: { nodes: {} },
        baseRevision: base,
        maxBytes: MAX,
      }),
    );
    expect(err.code).toBe("CONFLICT");
    expect(err.details.currentRevision).toBe(revisionOf(external));
    expect(await fileText(rel)).toBe(external);
  });

  it("refuses to recreate a layout file deleted externally (FAIL-04)", async () => {
    const rel = "diagrams/system-context.layout.yaml";
    const base = revisionOf(await fileText(rel));
    await root.remove(rel);
    const err = await saveError(
      writeLayout({
        root,
        model,
        diagramId: "system-context",
        edit: {},
        baseRevision: base,
        maxBytes: MAX,
      }),
    );
    expect(err).toMatchObject({ code: "CONFLICT", details: { currentRevision: null } });
    expect(err.message).toMatch(/deleted/);
  });

  it("refuses to clobber a file created externally since load", async () => {
    await ws.write("diagrams/containers.layout.yaml", "# someone else's file\n");
    const err = await saveError(
      writeLayout({
        root,
        model,
        diagramId: "containers",
        edit: {},
        baseRevision: null,
        maxBytes: MAX,
      }),
    );
    expect(err.code).toBe("CONFLICT");
    expect(await fileText("diagrams/containers.layout.yaml")).toBe("# someone else's file\n");
  });

  it("refuses non-writable targets", async () => {
    const m = structuredClone(model);
    m.sources["entity:extra"] = { file: "diagrams/containers.layout.yaml", document: 1, path: [] };
    const err = await saveError(
      writeLayout({
        root,
        model: m,
        diagramId: "containers",
        edit: {},
        baseRevision: null,
        maxBytes: MAX,
      }),
    );
    expect(err.code).toBe("NOT_WRITABLE");
  });

  it("preserves the previous file when the write fails (RELI-12, failure injection)", async () => {
    const rel = "diagrams/system-context.layout.yaml";
    const before = await fileText(rel);
    const failingRoot = await WorkspaceRoot.open(ws.dir, {
      ...nodeAtomicWriteOps,
      rename: () => Promise.reject(Object.assign(new Error("ENOSPC"), { code: "ENOSPC" })),
    });
    const err = await saveError(
      writeLayout({
        root: failingRoot,
        model,
        diagramId: "system-context",
        edit: { nodes: { customer: { x: 1, y: 1 } } },
        baseRevision: revisionOf(before),
        maxBytes: MAX,
      }),
    );
    expect(err.code).toBe("WRITE_FAILED");
    expect(err.message).toMatch(/previous file is unchanged/);
    expect(await fileText(rel)).toBe(before);
  });

  it("reports unreadable layout files as write failures (FAIL-06)", async () => {
    const rel = "diagrams/system-context.layout.yaml";
    await chmod(path.join(ws.dir, rel), 0o000);
    const err = await saveError(
      writeLayout({
        root,
        model,
        diagramId: "system-context",
        edit: {},
        baseRevision: null,
        maxBytes: MAX,
      }),
    );
    await chmod(path.join(ws.dir, rel), 0o644);
    expect(err.code).toBe("WRITE_FAILED");
  });

  it("never touches canonical or unrelated files (LAYOUT-22, LAYOUT-23)", async () => {
    const before = await hashTree(ws.dir);
    const result = await writeLayout({
      root,
      model,
      diagramId: "containers",
      edit: { nodes: { "web-shop": { x: 1, y: 1 } } },
      baseRevision: null,
      maxBytes: MAX,
    });
    const after = await hashTree(ws.dir);
    const changed = Object.keys(after).filter((f) => after[f] !== before[f]);
    expect(changed).toEqual([path.normalize(result.path)]);
  });
});

describe("drafts (RELI-10, RELI-11)", () => {
  const now = () => new Date("2026-01-02T03:04:05.000Z");

  it("saves, loads and discards drafts, with a .gitignore", async () => {
    const store = new DraftStore(root, MAX, now);
    const base = revisionOf("x");
    await store.save("containers", base, { nodes: { "web-shop": { x: 1, y: 2 } } });
    expect(await fileText(".archidoc/.gitignore")).toBe("*\n");
    expect(await store.load("containers")).toEqual({
      version: 1,
      diagram: "containers",
      baseRevision: base,
      savedAt: "2026-01-02T03:04:05.000Z",
      layout: { nodes: { "web-shop": { x: 1, y: 2 } } },
    });
    await store.save("containers", base, {});
    await store.discard("containers");
    expect(await store.load("containers")).toBeNull();
  });

  it("does not overwrite an existing .gitignore", async () => {
    await ws.write(".archidoc/.gitignore", "custom\n");
    await new DraftStore(root, MAX, now).save("containers", null, {});
    expect(await fileText(".archidoc/.gitignore")).toBe("custom\n");
  });

  it("drafts are not discovered as workspace resources", async () => {
    await new DraftStore(root, MAX).save("containers", null, {});
    expect(
      Object.keys((await loadWorkspace(root)).files).some((f) => f.startsWith(".archidoc")),
    ).toBe(false);
  });

  it("rejects invalid draft content and unsafe IDs", async () => {
    const store = new DraftStore(root, MAX);
    await expect(
      store.save("containers", null, { nodes: { a: { x: "no" } } } as never),
    ).rejects.toThrow();
    expect(() => draftPath("../escape")).toThrow();
  });

  it.each([
    ["not JSON", "{oops", "not valid JSON"],
    ["wrong shape", JSON.stringify({ version: 2 }), "does not match"],
    [
      "different diagram",
      JSON.stringify({
        version: 1,
        diagram: "other",
        baseRevision: null,
        savedAt: "2026-01-01T00:00:00.000Z",
        layout: {},
      }),
      "does not match",
    ],
  ])("reports corrupt drafts (%s) instead of throwing", async (_name, content, reason) => {
    await ws.write(`${DRAFTS_DIR}/containers.json`, content);
    const loaded = await new DraftStore(root, MAX).load("containers");
    expect(loaded).toEqual({ corrupt: expect.stringContaining(reason) });
    expect(assessDraft(loaded!, null, model.diagrams.containers)).toEqual({
      status: "corrupt",
      reason: expect.stringContaining(reason),
    });
  });

  it("reports unreadable drafts as corrupt", async () => {
    await ws.write(`${DRAFTS_DIR}/containers.json`, "x".repeat(100));
    expect(await new DraftStore(root, 10).load("containers")).toEqual({
      corrupt: expect.stringMatching(/limit/),
    });
  });

  describe("assessDraft", () => {
    const draft = (layout: object, baseRevision: string | null = null) => ({
      version: 1 as const,
      diagram: "containers",
      baseRevision: baseRevision as never,
      savedAt: "2026-01-01T00:00:00.000Z",
      layout,
    });

    it("is recoverable when the base revision and nodes still match", () => {
      expect(
        assessDraft(
          draft({ nodes: { "web-shop": { x: 1, y: 1 } } }),
          null,
          model.diagrams.containers,
        ).status,
      ).toBe("recoverable");
    });

    it("is a conflict when the layout file changed since the draft (FAIL-03)", () => {
      const state = assessDraft(
        draft({}, revisionOf("old")),
        revisionOf("new"),
        model.diagrams.containers,
      );
      expect(state).toMatchObject({ status: "conflict", currentRevision: revisionOf("new") });
    });

    it("is incompatible when nodes, edges or the diagram disappeared", () => {
      expect(
        assessDraft(
          draft({ nodes: { ghost: { x: 1, y: 1 } }, edges: { gone: {} } }),
          null,
          model.diagrams.containers,
        ),
      ).toMatchObject({
        status: "incompatible",
        issues: [
          "node 'ghost' is no longer in the diagram",
          "edge 'gone' is no longer in the diagram",
        ],
      });
      expect(assessDraft(draft({ nodes: { a: { x: 1, y: 1 } } }), null, undefined)).toMatchObject({
        status: "incompatible",
        issues: ["diagram 'containers' no longer exists"],
      });
    });
  });
});
