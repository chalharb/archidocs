import { describe, expect, it } from "vitest";
import { structuralView } from "../support/views.ts";
import type { ViewNode } from "../../src/core/views/index.ts";
import { layoutView } from "../../src/render/index.ts";
import { NAME_LINE, NODE_MAX_WIDTH, NODE_SIZES, nameRoom, nodeSize } from "../../src/render/layout.ts";
import { textWidth } from "../../src/render/text.ts";
import { deploymentViewWorkspace, landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";
import { layoutProblems } from "./geometry.ts";
import { syntheticWorkspace } from "./synthetic.ts";

const noProblems = { overlaps: [], throughNodes: [], diagonal: [], detached: [] };

describe("layoutView", () => {
  it("places every node of the C1 Landscape and routes every edge, meeting the auto-layout definition", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);
    const view = structuralView(bundle, "c1")!;
    const layout = await layoutView(view);

    expect(layout.nodes.map((n) => n.id)).toEqual(view.nodes.map((n) => n.id));
    expect(layout.edges.map((e) => [e.from, e.to])).toEqual(view.edges.map((e) => [e.from, e.to]));
    expect(layoutProblems(layout)).toEqual(noProblems);
  });
});

describe("the auto-layout definition", () => {
  const cases = ["c1", "c2", "c2 expanded", "c2/land:sys-a", "c3/land:sys-a-svc-0"];
  for (const direction of ["TB", "BT", "LR", "RL"] as const) {
    it.each(cases)(`holds for %s drawn ${direction}`, async (name) => {
      const { bundle, issues } = await loadWorkspace(syntheticWorkspace());
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
      const systems = bundle.elements.filter((e) => e.kind === "system").map((e) => e.id);
      const view = name === "c2 expanded" ? structuralView(bundle, "c2", { expand: systems })! : structuralView(bundle, name)!;
      expect(view.edges.length).toBeGreaterThan(0);
      const layout = await layoutView(view, { direction });

      expect(layout.edges).toHaveLength(view.edges.length);
      expect(layoutProblems(layout)).toEqual(noProblems);
    });
  }
});

describe("a Deployment View's layout", () => {
  it.each(["TB", "LR"] as const)("meets the auto-layout definition drawn %s, with every Deployment inside its Target", async (direction) => {
    const { bundle } = await loadWorkspace(deploymentViewWorkspace);
    const view = structuralView(bundle, "deployment/prod")!;
    const layout = await layoutView(view, { direction });
    const boxes = new Map(layout.nodes.map((n) => [n.id, n]));
    const inside = (a: string, b: string) => {
      const [x, y] = [boxes.get(a)!, boxes.get(b)!];
      return x.x >= y.x && x.y >= y.y && x.x + x.width <= y.x + y.width && x.y + x.height <= y.y + y.height;
    };

    expect(layout.edges).toHaveLength(view.edges.length);
    expect(layoutProblems(layout)).toEqual(noProblems);
    for (const n of view.nodes) if (n.parent !== null) expect(inside(n.id, n.parent), `${n.id} in ${n.parent}`).toBe(true);
  });
});

/** Positions to the hundredth of a pixel, so float noise from adding offsets is not movement. */
const hundredths = (n: number) => Math.round(n * 100) / 100;

describe("layout stability", () => {
  /** Each node's position relative to its container, for the nodes inside `system`. */
  const insideOf = (layout: Awaited<ReturnType<typeof layoutView>>, system: string) => {
    const boxes = new Map(layout.nodes.map((n) => [n.id, n]));
    return layout.nodes
      .filter((n) => n.parent === system)
      .map((n) => ({ id: n.id, x: hundredths(n.x - boxes.get(system)!.x), y: hundredths(n.y - boxes.get(system)!.y) }));
  };

  it("moves no node inside an untouched System when one Service is added", async () => {
    const before = await loadWorkspace(syntheticWorkspace());
    const after = await loadWorkspace(syntheticWorkspace({ extraService: { system: 2, to: "sys-c-svc-3" } }));
    expect(after.bundle.elements).toHaveLength(before.bundle.elements.length + 1);
    const systems = before.bundle.elements.filter((e) => e.kind === "system").map((e) => e.id);
    const [a, b] = await Promise.all(
      [before, after].map(({ bundle }) => layoutView(structuralView(bundle, "c2", { expand: systems })!)),
    );

    const untouched = systems.filter((s) => s !== "land:sys-c");
    expect(untouched).toHaveLength(5);
    for (const system of untouched) expect(insideOf(b!, system), system).toEqual(insideOf(a!, system));
    expect(insideOf(b!, "land:sys-c")).not.toEqual(insideOf(a!, "land:sys-c"));
  });

  it("gives the same Layout for the same View every time", async () => {
    const { bundle } = await loadWorkspace(syntheticWorkspace());
    const view = structuralView(bundle, "c2", { expand: ["land:sys-a", "land:sys-b"] })!;

    expect(await layoutView(view)).toEqual(await layoutView(view));
  });
});

describe("nodeSize", () => {
  const node = (name: string, over: Partial<ViewNode> = {}): ViewNode => ({ id: "n", kind: "service", name, parent: null, collapsed: false, external: false, ...over });

  it("keeps a short name's box at its kind's size", () => {
    expect(nodeSize(node("API"))).toEqual(NODE_SIZES.service);
  });

  it("widens the box until a long name fits on one line", () => {
    const name = "Mainframe Banking Facade";
    const { width, height } = nodeSize(node(name));
    expect(width).toBeGreaterThan(NODE_SIZES.service.width);
    expect(nameRoom(node(name), width)).toBeGreaterThanOrEqual(textWidth(name, 13, 700));
    expect(height).toBe(NODE_SIZES.service.height);
  });

  it("caps the width and gives a longer name a second line", () => {
    const size = nodeSize(node("Accounts Summary and Quarterly Regulatory Reporting Controller"));
    expect(size).toEqual({ width: NODE_MAX_WIDTH, height: NODE_SIZES.service.height + NAME_LINE });
  });

  it("leaves room for the expand toggle and the way in on a collapsed System", () => {
    const name = "Internet Banking System";
    expect(nodeSize(node(name, { kind: "system", collapsed: true })).width).toBeGreaterThan(nodeSize(node(name, { kind: "component" })).width);
  });
});
