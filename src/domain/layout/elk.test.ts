import { describe, expect, it } from "vitest";
import { BASE_TYPES, buildModel, docs, res } from "../../../tests/helpers/model";
import { resolveDiagram, type ResolvedDiagram } from "../diagram-resolve";
import type { LayoutDirection } from "../resources";
import { BOUNDARY_PADDING, elkPositionGenerator, layoutAll, nearestFreeSlot } from "./elk";
import { overlaps, resolveLayoutAsync } from "./positions";
import { APP_DEFAULT_LAYOUT_SETTINGS } from "./settings";

const S = APP_DEFAULT_LAYOUT_SETTINGS;

/** a -> b -> c, plus a boundary `sys` containing b and c. */
function chainDiagram(withBoundary = false): ResolvedDiagram {
  const { model } = buildModel({
    "types.yaml": BASE_TYPES,
    "e.yaml": res(
      "EntitySet",
      `id: es
entities:
  - {id: sys, name: Sys, type: software-system}
  - {id: a, name: A, type: actor}
  - {id: b, name: B, type: container, parent: sys}
  - {id: c, name: C, type: container, parent: sys}`,
    ),
    "r.yaml": res(
      "RelationshipSet",
      `id: rs
relationships:
  - {id: ab, type: uses, source: a, target: b}
  - {id: bc, type: uses, source: b, target: c}
  - {id: a-sys, type: uses, source: a, target: sys}
  - {id: sys-b, type: uses, source: sys, target: b}`,
    ),
    "d.yaml": res(
      "Diagram",
      `id: d
name: D
diagramType: c4-container
nodes: [${withBoundary ? "{entity: sys}, " : ""}{entity: a}, {entity: b}, {entity: c}]
edges: [{relationship: ab}, {relationship: bc}${withBoundary ? ", {relationship: sys-b}" : ""}]`,
    ),
  });
  return resolveDiagram(model, "d").diagram!;
}

const center = (p: { x: number; y: number; width: number; height: number }) => ({
  x: p.x + p.width / 2,
  y: p.y + p.height / 2,
});

describe("LAYOUT-04/05/06 ELK.js automatic layout", () => {
  it("places every node with the configured size", async () => {
    const d = chainDiagram();
    const out = await layoutAll({ nodes: d.nodes, edges: d.edges, settings: S });
    expect(Object.keys(out).sort()).toEqual(["a", "b", "c"]);
    for (const p of Object.values(out)) {
      expect(p.width).toBe(S.nodeWidth);
      expect(p.height).toBe(S.nodeHeight);
    }
  });

  it.each<[LayoutDirection, "x" | "y", 1 | -1]>([
    ["DOWN", "y", 1],
    ["UP", "y", -1],
    ["RIGHT", "x", 1],
    ["LEFT", "x", -1],
  ])("orients layers %s (LAYOUT-05)", async (direction, axis, sign) => {
    const d = chainDiagram();
    const out = await layoutAll({ nodes: d.nodes, edges: d.edges, settings: { ...S, direction } });
    const [a, b, c] = [center(out.a!), center(out.b!), center(out.c!)];
    expect(sign * (b[axis] - a[axis])).toBeGreaterThan(0);
    expect(sign * (c[axis] - b[axis])).toBeGreaterThan(0);
  });

  it("uses the layer spacing between layers (LAYOUT-06)", async () => {
    const d = chainDiagram();
    const gap = async (layerSpacing: number) => {
      const out = await layoutAll({
        nodes: d.nodes,
        edges: d.edges,
        settings: { ...S, layerSpacing },
      });
      return out.b!.y - (out.a!.y + out.a!.height);
    };
    expect(await gap(40)).toBeCloseTo(40, 0);
    expect(await gap(300)).toBeCloseTo(300, 0);
  });

  it("uses the node spacing between nodes in a layer (LAYOUT-06)", async () => {
    const { model } = buildModel({
      "types.yaml": BASE_TYPES,
      "e.yaml": res(
        "EntitySet",
        "id: es\nentities:\n  - {id: a, name: A, type: actor}\n  - {id: b, name: B, type: actor}",
      ),
      "d.yaml": res(
        "Diagram",
        "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: a}, {entity: b}]",
      ),
    });
    const d = resolveDiagram(model, "d").diagram!;
    const out = await layoutAll({
      nodes: d.nodes,
      edges: d.edges,
      settings: { ...S, nodeSpacing: 150 },
    });
    const [left, right] = [out.a!, out.b!].sort((p, q) => p.x - q.x);
    expect(right!.x - (left!.x + left!.width)).toBeCloseTo(150, 0);
  });

  it("is reproducible for identical input (LAYOUT-21)", async () => {
    const d = chainDiagram(true);
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => layoutAll({ nodes: d.nodes, edges: d.edges, settings: S })),
    );
    for (const r of runs) expect(r).toEqual(runs[0]);
    expect(JSON.stringify(runs[0])).toMatchSnapshot();
  });

  it("returns nothing for an empty diagram", async () => {
    expect(await layoutAll({ nodes: [], edges: [], settings: S })).toEqual({});
  });

  it("honours explicit leaf sizes", async () => {
    const d = chainDiagram();
    const out = await layoutAll({
      nodes: d.nodes,
      edges: d.edges,
      settings: S,
      sizes: { a: { width: 333, height: 77 } },
    });
    expect(out.a).toMatchObject({ width: 333, height: 77 });
  });
});

describe("LAYOUT-14 nested boundaries", () => {
  it("resolves a node's boundary to its nearest shown ancestor", () => {
    const d = chainDiagram(true);
    expect(d.nodes.find((n) => n.id === "b")!.boundary).toBe("sys");
    expect(d.nodes.find((n) => n.id === "a")!.boundary).toBeUndefined();
    expect(d.nodes.find((n) => n.id === "sys")!.boundary).toBeUndefined();
  });

  it("skips ancestors not in the diagram and ignores ambiguous ones", () => {
    const { model } = buildModel({
      "types.yaml": BASE_TYPES,
      "e.yaml": res(
        "EntitySet",
        `id: es
entities:
  - {id: top, name: Top, type: software-system}
  - {id: mid, name: Mid, type: container, parent: top}
  - {id: leaf, name: Leaf, type: container, parent: mid}`,
      ),
      "d.yaml": docs(
        res(
          "Diagram",
          "id: d1\nname: D1\ndiagramType: custom\nnodes: [{entity: top}, {entity: leaf}]",
        ),
        res(
          "Diagram",
          "id: d2\nname: D2\ndiagramType: custom\nnodes: [{id: t1, entity: top}, {id: t2, entity: top}, {entity: leaf}]",
        ),
      ),
    });
    expect(resolveDiagram(model, "d1").diagram!.nodes[1]!.boundary).toBe("top");
    expect(resolveDiagram(model, "d2").diagram!.nodes[2]!.boundary).toBeUndefined();
  });

  it("sizes boundaries around their contents with padding, in absolute coordinates", async () => {
    const d = chainDiagram(true);
    const out = await layoutAll({ nodes: d.nodes, edges: d.edges, settings: S });
    const sys = out.sys!;
    for (const id of ["b", "c"]) {
      const n = out[id]!;
      expect(n.x).toBeGreaterThanOrEqual(sys.x + BOUNDARY_PADDING.left - 0.01);
      expect(n.y).toBeGreaterThanOrEqual(sys.y + BOUNDARY_PADDING.top - 0.01);
      expect(n.x + n.width).toBeLessThanOrEqual(sys.x + sys.width - BOUNDARY_PADDING.right + 0.01);
      expect(n.y + n.height).toBeLessThanOrEqual(
        sys.y + sys.height - BOUNDARY_PADDING.bottom + 0.01,
      );
    }
    expect(overlaps(out.a!, sys)).toBe(false);
  });
});

describe("LAYOUT-24 partial regeneration", () => {
  it("places only nodes without manual positions and never moves manual ones", async () => {
    const d = chainDiagram();
    const layout = { diagram: "d", settings: {}, nodes: { b: { x: 5000, y: 5000 } }, edges: {} };
    const r = await resolveLayoutAsync({
      diagram: d,
      layout,
      settings: S,
      generator: elkPositionGenerator(d),
    });
    expect(r.positions.b).toEqual({ x: 5000, y: 5000, width: 200, height: 100, source: "manual" });
    expect(r.positions.a!.source).toBe("generated");
    expect(r.positions.c!.source).toBe("generated");
    expect(r.collisions).toEqual([]);
  });

  it("nudges generated nodes off manual boxes", async () => {
    const d = chainDiagram();
    const full = await layoutAll({ nodes: d.nodes, edges: d.edges, settings: S });
    // Park `a` exactly where ELK wants to put `b`.
    const layout = {
      diagram: "d",
      settings: {},
      nodes: { a: { x: full.b!.x, y: full.b!.y } },
      edges: {},
    };
    const r = await resolveLayoutAsync({
      diagram: d,
      layout,
      settings: S,
      generator: elkPositionGenerator(d),
    });
    expect(r.positions.a).toMatchObject({ x: full.b!.x, y: full.b!.y, source: "manual" });
    expect(overlaps(r.positions.b!, r.positions.a!)).toBe(false);
    expect(overlaps(r.positions.b!, r.positions.c!)).toBe(false);
    expect(r.collisions).toEqual([]);
  });

  it("moves new contents with a manually placed boundary", async () => {
    const d = chainDiagram(true);
    const full = await layoutAll({ nodes: d.nodes, edges: d.edges, settings: S });
    const layout = {
      diagram: "d",
      settings: {},
      nodes: {
        sys: {
          x: full.sys!.x + 1000,
          y: full.sys!.y + 500,
          width: full.sys!.width,
          height: full.sys!.height,
        },
      },
      edges: {},
    };
    const r = await resolveLayoutAsync({
      diagram: d,
      layout,
      settings: S,
      generator: elkPositionGenerator(d),
    });
    expect(r.positions.b!.x).toBeCloseTo(full.b!.x + 1000);
    expect(r.positions.b!.y).toBeCloseTo(full.b!.y + 500);
    expect(r.collisions).toEqual([]);
  });

  it("moves new contents with a generated boundary that had to be nudged", async () => {
    const d = chainDiagram(true);
    const full = await layoutAll({ nodes: d.nodes, edges: d.edges, settings: S });
    const layout = {
      diagram: "d",
      settings: {},
      nodes: { a: { x: full.sys!.x, y: full.sys!.y } },
      edges: {},
    };
    const r = await resolveLayoutAsync({
      diagram: d,
      layout,
      settings: S,
      generator: elkPositionGenerator(d),
    });
    const sys = r.positions.sys!;
    expect(overlaps(sys, r.positions.a!)).toBe(false);
    const dx = sys.x - full.sys!.x;
    const dy = sys.y - full.sys!.y;
    expect(r.positions.b!.x).toBeCloseTo(full.b!.x + dx);
    expect(r.positions.b!.y).toBeCloseTo(full.b!.y + dy);
  });

  it("nearestFreeSlot returns the box unchanged when free, and gives up deterministically", () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(nearestFreeSlot(box, [], 10)).toBe(box);
    const wall = { x: -1e6, y: -1e6, width: 2e6, height: 2e6 };
    expect(nearestFreeSlot(box, [wall], 10, 3)).toBe(box);
    const moved = nearestFreeSlot(box, [{ ...box }], 10);
    expect(overlaps(moved, box)).toBe(false);
    expect(nearestFreeSlot(box, [{ ...box }], 10)).toEqual(moved);
  });
});
