import { describe, expect, it } from "vitest";
import type { ResolvedEdge, ResolvedNode } from "@/domain/diagram-resolve";
import { toFlowEdges, toFlowNodes } from "./flow";
import type { EditorDoc } from "./state";

const style = { shape: "rectangle", color: "primary" } as const;
const node = (id: string, boundary?: string): ResolvedNode => ({
  id,
  entityId: `e-${id}`,
  label: id.toUpperCase(),
  entityType: "container",
  style,
  ...(boundary ? { boundary } : {}),
});
const doc = (boxes: EditorDoc["boxes"]): EditorDoc => ({
  boxes,
  placed: [],
  settings: {},
  edges: {},
});

describe("React Flow conversion", () => {
  it("orders parents first, uses relative child positions and keeps references (DIAG-08)", () => {
    const nodes = [node("inner", "mid"), node("mid", "top"), node("top"), node("loose")];
    const out = toFlowNodes(
      nodes,
      doc({
        top: { x: 100, y: 100, width: 800, height: 600 },
        mid: { x: 150, y: 200, width: 400, height: 300 },
        inner: { x: 160, y: 260, width: 200, height: 100 },
        loose: { x: 0, y: 0, width: 200, height: 100 },
      }),
      { selected: new Set(["loose"]) },
    );
    expect(out.map((n) => n.id)).toEqual(["top", "loose", "mid", "inner"]);
    const byId = Object.fromEntries(out.map((n) => [n.id, n]));
    expect(byId.top).toMatchObject({ type: "boundary", position: { x: 100, y: 100 }, width: 800 });
    expect(byId.mid).toMatchObject({
      type: "boundary",
      parentId: "top",
      position: { x: 50, y: 100 },
    });
    expect(byId.inner).toMatchObject({
      type: "element",
      parentId: "mid",
      position: { x: 10, y: 60 },
    });
    expect(byId.inner!.data.node.entityId).toBe("e-inner");
    expect(byId.loose!.selected).toBe(true);
    expect(byId.top!.selected).toBe(false);
    expect(byId.loose!.ariaLabel).toBe("LOOSE (container)");
  });

  it("skips nodes without a box and survives boundary cycles", () => {
    const nodes = [node("a", "b"), node("b", "a"), node("c")];
    const out = toFlowNodes(
      nodes,
      doc({ a: { x: 0, y: 0, width: 1, height: 1 }, b: { x: 5, y: 5, width: 1, height: 1 } }),
    );
    expect(out.map((n) => n.id).sort()).toEqual(["a", "b"]);
    const noOpts = toFlowNodes(
      [node("x", "missing")],
      doc({ x: { x: 1, y: 2, width: 3, height: 4 } }),
    );
    expect(noOpts[0]).toMatchObject({ position: { x: 1, y: 2 }, selected: false });
    expect(noOpts[0]!.parentId).toBeUndefined();
  });

  it("builds edges with their presentation and filters dangling ones", () => {
    const edges: ResolvedEdge[] = [
      {
        id: "e1",
        relationshipId: "r1",
        relationshipType: "uses",
        source: "a",
        target: "b",
        label: "Calls",
        style: { line: "solid", color: "gray" },
      },
      {
        id: "e2",
        relationshipId: "r2",
        relationshipType: "uses",
        source: "a",
        target: "gone",
        style: { line: "dashed", color: "gray" },
      },
    ];
    const out = toFlowEdges(
      edges,
      (id) => ({ edgeType: id === "e1" ? "step" : "bezier", animated: id === "e1" }),
      {
        selected: "e1",
        nodeIds: new Set(["a", "b"]),
      },
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "e1",
      type: "arch",
      selected: true,
      data: { edgeType: "step", animated: true, edge: { relationshipId: "r1" } },
      ariaLabel: "Calls: a to b",
    });
    const all = toFlowEdges(edges, () => ({ edgeType: "straight", animated: false }));
    expect(all.map((e) => [e.id, e.selected, e.ariaLabel])).toEqual([
      ["e1", false, "Calls: a to b"],
      ["e2", false, "uses: a to gone"],
    ]);
  });
});
