import { describe, expect, it } from "vitest";
import { BASE_TYPES, buildModel, res } from "../../tests/helpers/model";
import { resolveDiagram } from "@/domain/diagram-resolve";
import { resolveLayout } from "@/domain/layout/positions";
import { APP_DEFAULT_LAYOUT_SETTINGS, resolveLayoutSettings } from "@/domain/layout/settings";
import type { CanonicalDiagramLayout } from "@/domain/model";
import {
  alignNodes,
  applyRelayout,
  descendants,
  distributeNodes,
  docFromView,
  docKey,
  edgeAnimatedOf,
  edgeTypeOf,
  effectiveSettings,
  moveNodes,
  rebaseDoc,
  resizeNode,
  sameDoc,
  setEdgePresentation,
  setSetting,
  toLayoutEdit,
  type DiagramViewData,
} from "./state";

function view(saved?: Partial<CanonicalDiagramLayout>, diagramLayout = ""): DiagramViewData {
  const { model } = buildModel({
    "types.yaml": BASE_TYPES,
    "e.yaml": res(
      "EntitySet",
      `id: es
entities:
  - {id: sys, name: Sys, type: software-system}
  - {id: a, name: A, type: container, parent: sys}
  - {id: b, name: B, type: container, parent: sys}
  - {id: u, name: U, type: actor}`,
    ),
    "r.yaml": res(
      "RelationshipSet",
      "id: rs\nrelationships:\n  - {id: ua, type: uses, source: u, target: a}\n  - {id: ab, type: uses, source: a, target: b}",
    ),
    "d.yaml": res(
      "Diagram",
      `id: d\nname: D\ndiagramType: c4-container\n${diagramLayout}nodes: [{entity: sys}, {entity: a}, {entity: b}, {entity: u}]\nedges: [{relationship: ua}, {relationship: ab}]`,
    ),
  });
  const diagram = resolveDiagram(model, "d").diagram!;
  const layout: CanonicalDiagramLayout = {
    diagram: "d",
    settings: {},
    nodes: {},
    edges: {},
    ...saved,
  };
  const inherited = resolveLayoutSettings({ diagram: model.diagrams.d!.layout }).settings;
  const settings = resolveLayoutSettings({
    diagram: model.diagrams.d!.layout,
    layout: layout.settings,
  });
  const { diagnostics: _d, ...resolved } = resolveLayout({
    diagram,
    layout,
    settings: settings.settings,
  });
  return { diagram, layout: resolved, saved: layout, inheritedSettings: inherited };
}

describe("editor document", () => {
  it("starts from the view: boxes for every node, manual ones marked placed", () => {
    const v = view({
      nodes: { u: { x: 5, y: 6 } },
      settings: { gridSize: 10 },
      edges: { ab: { type: "step" } },
    });
    const doc = docFromView(v);
    expect(Object.keys(doc.boxes).sort()).toEqual(["a", "b", "sys", "u"]);
    expect(doc.placed).toEqual(["u"]);
    expect(doc.boxes.u).toEqual({ x: 5, y: 6, width: 200, height: 100 });
    expect(doc.settings).toEqual({ gridSize: 10 });
    expect(doc.edges).toEqual({ ab: { type: "step" } });
  });

  it("resolves effective settings over inherited ones, and per-edge values", () => {
    const v = view(undefined, "layout: {edgeType: bezier, direction: LEFT}\n");
    let doc = docFromView(v);
    expect(effectiveSettings(v, doc).edgeType).toBe("bezier");
    expect(effectiveSettings(v, doc).direction).toBe("LEFT");
    doc = setSetting(doc, "edgeType", "straight");
    expect(effectiveSettings(v, doc).edgeType).toBe("straight");
    expect(edgeTypeOf(v, doc, "ab")).toBe("straight");
    doc = setEdgePresentation(doc, "ab", { type: "step", animated: true });
    expect(edgeTypeOf(v, doc, "ab")).toBe("step");
    expect(edgeAnimatedOf(v, doc, "ab")).toBe(true);
    expect(edgeAnimatedOf(v, doc, "ua")).toBe(APP_DEFAULT_LAYOUT_SETTINGS.animateEdges);
    doc = setSetting(doc, "edgeType", undefined);
    expect(doc.settings.edgeType).toBeUndefined();
    expect(effectiveSettings(v, doc).edgeType).toBe("bezier");
  });

  it("clears empty edge presentation entries", () => {
    let doc = docFromView(view());
    doc = setEdgePresentation(doc, "ab", { animated: true });
    expect(doc.edges.ab).toEqual({ animated: true });
    doc = setEdgePresentation(doc, "ab", { type: "bezier" });
    expect(doc.edges.ab).toEqual({ animated: true, type: "bezier" });
    doc = setEdgePresentation(doc, "ab", { animated: undefined, type: undefined });
    expect(doc.edges.ab).toBeUndefined();
  });

  it("moves boundaries together with their contents (ADD-006)", () => {
    const v = view();
    const doc = docFromView(v);
    expect(descendants(v.diagram, "sys").sort()).toEqual(["a", "b"]);
    expect(descendants(v.diagram, "u")).toEqual([]);
    const sys = doc.boxes.sys!;
    const moved = moveNodes(doc, v.diagram, { sys: { x: sys.x + 100, y: sys.y + 50 } });
    expect(moved.boxes.a).toMatchObject({ x: doc.boxes.a!.x + 100, y: doc.boxes.a!.y + 50 });
    expect(moved.placed).toEqual(["a", "b", "sys"]);
    // Explicitly moved children are not shifted twice.
    const both = moveNodes(doc, v.diagram, {
      sys: { x: sys.x + 100, y: sys.y },
      a: { x: 1, y: 2 },
    });
    expect(both.boxes.a).toMatchObject({ x: 1, y: 2 });
  });

  it("ignores no-op and unknown moves", () => {
    const v = view();
    const doc = docFromView(v);
    expect(moveNodes(doc, v.diagram, {})).toBe(doc);
    expect(moveNodes(doc, v.diagram, { ghost: { x: 1, y: 1 } })).toBe(doc);
    expect(moveNodes(doc, v.diagram, { u: { x: doc.boxes.u!.x, y: doc.boxes.u!.y } })).toBe(doc);
  });

  it("aligns, distributes and resizes", () => {
    const v = view({
      nodes: { a: { x: 0, y: 0 }, b: { x: 37, y: 300 }, u: { x: 90, y: 900 } },
    });
    const doc = docFromView(v);
    const left = alignNodes(doc, v.diagram, ["a", "b", "u"], "left");
    expect([left.boxes.a!.x, left.boxes.b!.x, left.boxes.u!.x]).toEqual([0, 0, 0]);
    const spread = distributeNodes(doc, v.diagram, ["a", "b", "u"], "vertical");
    expect(spread.boxes.b!.y).toBe(450);
    const r = resizeNode(doc, "u", { x: 90, y: 900, width: 300, height: 120 });
    expect(r.boxes.u).toEqual({ x: 90, y: 900, width: 300, height: 120 });
    expect(resizeNode(r, "u", { ...r.boxes.u! })).toBe(r);
    expect(resizeNode(r, "ghost", { x: 0, y: 0, width: 1, height: 1 })).toBe(r);
  });

  it("re-layout places every node", () => {
    const v = view();
    const doc = docFromView(v);
    const out = applyRelayout(doc, { u: { x: 1, y: 2, width: 3, height: 4 } });
    expect(out.placed).toEqual(["a", "b", "sys", "u"]);
    expect(out.boxes.u).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(out.boxes.a).toEqual(doc.boxes.a);
  });

  it("saves only overrides, sizes only when non-default, and drops orphans", () => {
    const v = view({
      nodes: { u: { x: 5, y: 6 }, sys: { x: 0, y: 0, width: 600, height: 400 } },
      edges: { ab: { type: "step" } },
      settings: { snapToGrid: false },
    });
    let doc = docFromView(v);
    doc = {
      ...doc,
      placed: [...doc.placed, "ghost"],
      edges: { ...doc.edges, gone: { type: "bezier" } },
    };
    expect(toLayoutEdit(v, doc)).toEqual({
      settings: { snapToGrid: false },
      nodes: { sys: { x: 0, y: 0, width: 600, height: 400 }, u: { x: 5, y: 6 } },
      edges: { ab: { type: "step" } },
    });
  });

  it("compares documents by content", () => {
    const v = view();
    const a = docFromView(v);
    const b = docFromView(v);
    expect(sameDoc(a, a)).toBe(true);
    expect(sameDoc(a, b)).toBe(true);
    expect(docKey(a)).toBe(docKey(b));
    expect(sameDoc(a, setSetting(a, "gridSize", 5))).toBe(false);
  });

  it("rebases local edits onto an externally changed view", () => {
    const base = view({
      nodes: { u: { x: 0, y: 0 } },
      settings: { gridSize: 10 },
      edges: { ua: { type: "step" } },
    });
    const baseDoc = docFromView(base);
    let local = moveNodes(baseDoc, base.diagram, { a: { x: 777, y: 888 } });
    local = setSetting(local, "direction", "LEFT");
    local = setSetting(local, "gridSize", undefined);
    local = setEdgePresentation(local, "ab", { animated: true });
    local = setEdgePresentation(local, "ua", { type: undefined });
    // Externally: u moved, gridSize changed, ab edge given a type.
    const next = view({
      nodes: { u: { x: 40, y: 40 } },
      settings: { gridSize: 30, nodeSpacing: 10 },
      edges: { ua: { type: "step" }, ab: { type: "bezier" } },
    });
    const rebased = rebaseDoc(baseDoc, local, next);
    expect(rebased.boxes.u).toMatchObject({ x: 40, y: 40 });
    expect(rebased.boxes.a).toMatchObject({ x: 777, y: 888 });
    expect(rebased.placed).toEqual(["a", "u"]);
    expect(rebased.settings).toEqual({ nodeSpacing: 10, direction: "LEFT" });
    expect(rebased.edges).toEqual({ ab: { animated: true } });
  });

  it("drops local positions of nodes removed externally", () => {
    const base = view();
    const local = moveNodes(docFromView(base), base.diagram, { u: { x: 1, y: 1 } });
    const next = {
      ...base,
      diagram: { ...base.diagram, nodes: base.diagram.nodes.filter((n) => n.id !== "u") },
    };
    const nextView = {
      ...next,
      layout: { ...next.layout, positions: { ...next.layout.positions } },
    };
    delete nextView.layout.positions.u;
    const rebased = rebaseDoc(docFromView(base), local, nextView);
    expect(rebased.boxes.u).toBeUndefined();
    expect(rebased.placed).toEqual([]);
  });
});

describe("draft recovery", () => {
  it("rebuilds the document from a draft, ignoring unknown nodes", async () => {
    const { docFromDraft } = await import("./state");
    const v = view({ nodes: { u: { x: 1, y: 1 } } });
    const doc = docFromDraft(v, {
      settings: { nodeWidth: 300 },
      nodes: {
        a: { x: 10, y: 20 },
        sys: { x: 0, y: 0, width: 900, height: 500 },
        ghost: { x: 0, y: 0 },
      },
      edges: { ab: { animated: true } },
    });
    expect(doc.placed).toEqual(["a", "sys"]);
    expect(doc.boxes.a).toEqual({ x: 10, y: 20, width: 300, height: 100 });
    expect(doc.boxes.sys).toEqual({ x: 0, y: 0, width: 900, height: 500 });
    expect(doc.boxes.ghost).toBeUndefined();
    expect(doc.settings).toEqual({ nodeWidth: 300 });
    expect(doc.edges).toEqual({ ab: { animated: true } });
    expect(docFromDraft(v, {}).placed).toEqual([]);
  });
});

describe("dirty tracking", () => {
  it("compares what would be saved, not generated positions", async () => {
    const { sameEdit } = await import("./state");
    const v = view({ nodes: { u: { x: 0, y: 0 } } });
    const a = docFromView(v);
    expect(sameEdit(v, a, a)).toBe(true);
    // Unplaced node moved by the generator: nothing to save.
    const regenerated = { ...a, boxes: { ...a.boxes, b: { ...a.boxes.b!, x: 999 } } };
    expect(sameEdit(v, a, regenerated)).toBe(true);
    // Settings in a different key order are the same edit.
    const s1 = setSetting(setSetting(a, "gridSize", 5), "direction", "UP");
    const s2 = setSetting(setSetting(a, "direction", "UP"), "gridSize", 5);
    expect(sameEdit(v, s1, s2)).toBe(true);
    expect(sameEdit(v, a, moveNodes(a, v.diagram, { u: { x: 1, y: 0 } }))).toBe(false);
    expect(sameEdit(v, a, setEdgePresentation(a, "ab", { type: "step" }))).toBe(false);
  });
});
