import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE_TYPES, buildModel, res } from "../../../tests/helpers/model";
import { resolveDiagram, type ResolvedDiagram } from "../diagram-resolve";
import type { CanonicalDiagramLayout } from "../model";
import { gridPositionGenerator, overlaps, resolveLayout } from "./positions";
import {
  LAYOUT_FILE_HEADER,
  parseLayoutFile,
  serializeLayout,
  toLayoutResource,
} from "./serialize";
import { APP_DEFAULT_LAYOUT_SETTINGS, resolveLayoutSettings } from "./settings";

const S = APP_DEFAULT_LAYOUT_SETTINGS;

function diagramWith(nodes: string[]): ResolvedDiagram {
  const entities = nodes.map((n) => `  - {id: ${n}, name: ${n}, type: actor}`).join("\n");
  const { model } = buildModel({
    "types.yaml": BASE_TYPES,
    "e.yaml": res("EntitySet", `id: es\nentities:\n${entities}`),
    "r.yaml": res(
      "RelationshipSet",
      `id: rs\nrelationships:\n  - {id: r, type: uses, source: ${nodes[0]}, target: ${nodes[1] ?? nodes[0]}}`,
    ),
    "d.yaml": res(
      "Diagram",
      `id: d\nname: D\ndiagramType: custom\nnodes: [${nodes.map((n) => `{entity: ${n}}`).join(", ")}]\nedges: [{relationship: r}]`,
    ),
  });
  return resolveDiagram(model, "d").diagram!;
}

const layout = (
  nodes: CanonicalDiagramLayout["nodes"],
  extra: Partial<CanonicalDiagramLayout> = {},
) => ({
  diagram: "d",
  settings: {},
  nodes,
  edges: {},
  ...extra,
});

describe("TEST-06 configuration precedence (PREC-01, PREC-02)", () => {
  it("uses application defaults when nothing is set", () => {
    const { settings, sources } = resolveLayoutSettings({});
    expect(settings).toEqual(APP_DEFAULT_LAYOUT_SETTINGS);
    expect(Object.values(sources).every((s) => s === "app")).toBe(true);
  });

  it("applies app → workspace → diagram → layout file, per key", () => {
    const { settings, sources } = resolveLayoutSettings({
      workspace: { direction: "LEFT", nodeSpacing: 10, gridSize: 5 },
      diagram: { direction: "RIGHT", layerSpacing: 30 },
      layout: { direction: "UP", edgeType: "step" },
    });
    expect(settings).toEqual({
      ...S,
      direction: "UP",
      nodeSpacing: 10,
      gridSize: 5,
      layerSpacing: 30,
      edgeType: "step",
    });
    expect(sources).toMatchObject({
      direction: "layout",
      nodeSpacing: "workspace",
      gridSize: "workspace",
      layerSpacing: "diagram",
      edgeType: "layout",
      snapToGrid: "app",
    });
  });

  it("explicit false/zero values still override", () => {
    const { settings } = resolveLayoutSettings({
      workspace: { snapToGrid: false, nodeSpacing: 0 },
    });
    expect(settings.snapToGrid).toBe(false);
    expect(settings.nodeSpacing).toBe(0);
  });

  it("is deterministic and does not mutate inputs or defaults (property)", () => {
    const overrides = fc.record(
      {
        direction: fc.constantFrom("DOWN", "UP", "LEFT", "RIGHT" as const),
        nodeSpacing: fc.integer({ min: 0, max: 1000 }),
        edgeType: fc.constantFrom("straight", "bezier", "step", "smoothstep" as const),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(overrides, overrides, overrides, (workspace, diagram, layoutLevel) => {
        const levels = { workspace, diagram, layout: layoutLevel };
        const snapshot = JSON.stringify(levels);
        const a = resolveLayoutSettings(levels);
        expect(resolveLayoutSettings(levels)).toEqual(a);
        expect(JSON.stringify(levels)).toBe(snapshot);
        for (const key of ["direction", "nodeSpacing", "edgeType"] as const) {
          const expected = layoutLevel[key] ?? diagram[key] ?? workspace[key] ?? S[key];
          expect(a.settings[key]).toBe(expected);
        }
      }),
    );
    expect(APP_DEFAULT_LAYOUT_SETTINGS.direction).toBe("DOWN");
  });
});

describe("TEST-06 layout resolution", () => {
  it("manual positions override generated ones; generated apply only to positioning (PREC-03)", () => {
    const d = diagramWith(["a", "b"]);
    const result = resolveLayout({
      diagram: d,
      layout: layout({ a: { x: 500, y: 600, width: 50 } }),
      settings: S,
    });
    expect(result.positions.a).toEqual({
      x: 500,
      y: 600,
      width: 50,
      height: S.nodeHeight,
      source: "manual",
    });
    expect(result.positions.b).toMatchObject({ source: "generated", width: S.nodeWidth });
    expect(result.edgeTypes).toEqual({ r: S.edgeType });
  });

  it("keeps manual positions across model changes and places new nodes (LAYOUT-16, LAYOUT-17)", () => {
    const saved = layout({ a: { x: 0, y: 0 }, b: { x: 1000, y: 1000 } });
    const before = resolveLayout({ diagram: diagramWith(["a", "b"]), layout: saved, settings: S });
    const after = resolveLayout({
      diagram: diagramWith(["a", "b", "c"]),
      layout: saved,
      settings: S,
    });
    expect(after.positions.a).toEqual(before.positions.a);
    expect(after.positions.b).toEqual(before.positions.b);
    expect(after.positions.c!.source).toBe("generated");
    expect(saved.nodes).toEqual({ a: { x: 0, y: 0 }, b: { x: 1000, y: 1000 } });
  });

  it("reports removed or renamed node and edge overrides as orphans (LAYOUT-18)", () => {
    const result = resolveLayout({
      diagram: diagramWith(["a", "b"]),
      layout: layout(
        { a: { x: 0, y: 0 }, gone: { x: 1, y: 1 } },
        { edges: { r: { type: "step" }, old: { type: "bezier" } } },
      ),
      settings: S,
    });
    expect(result.orphans).toEqual({ nodes: ["gone"], edges: ["old"] });
    expect(result.positions.gone).toBeUndefined();
    expect(result.edgeTypes).toEqual({ r: "step" });
  });

  it("handles duplicate entity instances independently", () => {
    const { model } = buildModel({
      "types.yaml": BASE_TYPES,
      "e.yaml": res("Entity", "id: a\nname: A\ntype: actor"),
      "d.yaml": res(
        "Diagram",
        "id: d\nname: D\ndiagramType: custom\nnodes: [{id: a1, entity: a}, {id: a2, entity: a}]",
      ),
    });
    const d = resolveDiagram(model, "d").diagram!;
    const result = resolveLayout({
      diagram: d,
      layout: layout({ a1: { x: 7, y: 7 } }),
      settings: S,
    });
    expect(result.positions.a1!.source).toBe("manual");
    expect(result.positions.a2!.source).toBe("generated");
    expect(overlaps(result.positions.a1!, result.positions.a2!)).toBe(false);
  });

  it("works without a layout file", () => {
    const result = resolveLayout({ diagram: diagramWith(["a", "b", "c"]), settings: S });
    expect(Object.values(result.positions).every((p) => p.source === "generated")).toBe(true);
    expect(result.orphans).toEqual({ nodes: [], edges: [] });
  });

  it("does not call the generator when every node is placed", () => {
    const result = resolveLayout({
      diagram: diagramWith(["a"]),
      layout: layout({ a: { x: 1, y: 2 } }),
      settings: S,
      generator: () => {
        throw new Error("should not run");
      },
    });
    expect(result.positions.a!.source).toBe("manual");
  });

  it("avoids manual boxes when generating (LAYOUT-24)", () => {
    const occupied = { a: { x: 0, y: 0 }, b: { x: S.nodeWidth + S.nodeSpacing, y: 0 } };
    const result = resolveLayout({
      diagram: diagramWith(["a", "b", "c", "d"]),
      layout: layout(occupied),
      settings: S,
    });
    expect(result.collisions).toEqual([]);
    for (const id of ["c", "d"]) {
      for (const m of ["a", "b"])
        expect(overlaps(result.positions[id]!, result.positions[m]!)).toBe(false);
    }
  });

  it("reports unresolved collisions without moving saved positions (LAYOUT-24)", () => {
    const result = resolveLayout({
      diagram: diagramWith(["a", "b"]),
      layout: layout({ a: { x: 0, y: 0 } }),
      settings: S,
      generator: () => ({ b: { x: 10, y: 10 } }),
    });
    expect(result.positions.a).toMatchObject({ x: 0, y: 0, source: "manual" });
    expect(result.collisions).toEqual([["b", "a"]]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "LAYOUT_COLLISION", severity: "warning" }),
    ]);
  });

  it("falls back to the origin when a generator omits a node", () => {
    const result = resolveLayout({
      diagram: diagramWith(["a"]),
      settings: S,
      generator: () => ({}),
    });
    expect(result.positions.a).toMatchObject({ x: 0, y: 0, source: "generated" });
  });

  it("is deterministic (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom("DOWN", "UP", "LEFT", "RIGHT" as const),
        (n, direction) => {
          const ids = Array.from({ length: n }, (_, i) => `n${i}`);
          const d = diagramWith(ids);
          const settings = { ...S, direction };
          const a = resolveLayout({ diagram: d, settings });
          expect(resolveLayout({ diagram: structuredClone(d), settings })).toEqual(a);
          const boxes = Object.values(a.positions);
          boxes.forEach((p, i) =>
            boxes.slice(i + 1).forEach((q) => expect(overlaps(p, q)).toBe(false)),
          );
        },
      ),
      { numRuns: 50 },
    );
  });

  it("grid generator fills columns for horizontal directions", () => {
    const nodes = diagramWith(["a", "b"]).nodes;
    const down = gridPositionGenerator({ nodes, edges: [], settings: S, occupied: [] });
    const right = gridPositionGenerator({
      nodes,
      edges: [],
      settings: { ...S, direction: "RIGHT" },
      occupied: [],
    });
    expect(down.b!.y).toBe(0);
    expect(right.b!.x).toBe(0);
  });
});

describe("TEST-05 layout serialization round-trip", () => {
  const sample: CanonicalDiagramLayout = {
    diagram: "d",
    settings: { edgeType: "step", direction: "LEFT" },
    nodes: { zeta: { x: 1.004, y: -0.001 }, alpha: { x: 10, y: 20, width: 300, height: 120 } },
    edges: { r2: { type: "bezier" }, r1: {} },
  };

  it("writes deterministic, ordered YAML with a header", () => {
    const text = serializeLayout(sample);
    expect(text.startsWith(LAYOUT_FILE_HEADER)).toBe(true);
    expect(text).toBe(`${LAYOUT_FILE_HEADER}apiVersion: archdocs/v1
kind: DiagramLayout
diagram: d
settings:
  direction: LEFT
  edgeType: step
nodes:
  alpha:
    x: 10
    y: 20
    width: 300
    height: 120
  zeta:
    x: 1
    y: 0
edges:
  r2:
    type: bezier
`);
  });

  it("omits empty sections", () => {
    expect(toLayoutResource({ diagram: "d", settings: {}, nodes: {}, edges: {} })).toEqual({
      apiVersion: "archdocs/v1",
      kind: "DiagramLayout",
      diagram: "d",
    });
  });

  it("round-trips through the parser", () => {
    const parsed = parseLayoutFile(serializeLayout(sample), "d.layout.yaml");
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.otherResources).toBe(0);
    expect(serializeLayout(parsed.layout!)).toBe(serializeLayout(sample));
  });

  it("round-trips arbitrary layouts (property)", () => {
    const id = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
    const coord = fc.double({ min: -1e5, max: 1e5, noNaN: true });
    fc.assert(
      fc.property(fc.dictionary(id, fc.record({ x: coord, y: coord })), (nodes) => {
        const text = serializeLayout({ diagram: "d", settings: {}, nodes, edges: {} });
        const again = parseLayoutFile(text, "f.layout.yaml");
        expect(again.diagnostics).toEqual([]);
        expect(serializeLayout(again.layout!)).toBe(text);
      }),
      { numRuns: 100 },
    );
  });

  it("reports layout files with no layout or extra resources", () => {
    expect(parseLayoutFile(res("EntityType", "id: t\nname: T"), "x.layout.yaml")).toEqual({
      diagnostics: [],
      otherResources: 1,
    });
    expect(parseLayoutFile("a: [", "x.layout.yaml").diagnostics[0]!.code).toBe("YAML_SYNTAX");
  });
});

describe("LAYOUT-25 animated edges (ADD-005)", () => {
  it("is off by default and joins the precedence chain like any setting", () => {
    expect(S.animateEdges).toBe(false);
    expect(resolveLayoutSettings({}).settings.animateEdges).toBe(false);
    const r = resolveLayoutSettings({
      workspace: { animateEdges: true },
      diagram: { animateEdges: false },
    });
    expect(r.settings.animateEdges).toBe(false);
    expect(r.sources.animateEdges).toBe("diagram");
    expect(resolveLayoutSettings({ layout: { animateEdges: true } }).settings.animateEdges).toBe(
      true,
    );
  });

  it("per-edge override wins over the resolved setting", () => {
    const d = diagramWith(["a", "b"]);
    const off = resolveLayout({ diagram: d, settings: S });
    expect(off.edgeAnimated).toEqual({ r: false });
    const on = resolveLayout({ diagram: d, settings: { ...S, animateEdges: true } });
    expect(on.edgeAnimated).toEqual({ r: true });
    const edgeOff = resolveLayout({
      diagram: d,
      layout: layout({}, { edges: { r: { animated: false } } }),
      settings: { ...S, animateEdges: true },
    });
    expect(edgeOff.edgeAnimated).toEqual({ r: false });
    expect(edgeOff.edgeTypes).toEqual({ r: S.edgeType });
  });

  it("serializes and round-trips the edge flag and setting", () => {
    const l: CanonicalDiagramLayout = {
      diagram: "d",
      settings: { animateEdges: true },
      nodes: {},
      edges: { b: { animated: true }, a: { type: "step", animated: false } },
    };
    const text = serializeLayout(l);
    expect(text).toBe(`${LAYOUT_FILE_HEADER}apiVersion: archdocs/v1
kind: DiagramLayout
diagram: d
settings:
  animateEdges: true
edges:
  a:
    type: step
    animated: false
  b:
    animated: true
`);
    const again = parseLayoutFile(text, "d.layout.yaml");
    expect(again.diagnostics).toEqual([]);
    expect(serializeLayout(again.layout!)).toBe(text);
  });
});
