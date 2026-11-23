import { describe, expect, it } from "vitest";
import { listViews, resolveView } from "../../src/core/index.ts";
import { loadWorkspace } from "../support/workspace.ts";
import { elementTreeWorkspace, relationshipWorkspace } from "../support/fixtures.ts";

/** A View's nodes as `[id, parent, collapsed]` and edges as `[from, to, relationship count]`, for compact assertions. */
const shape = (view: ReturnType<typeof resolveView>) => ({
  nodes: view?.nodes.map((n) => [n.id, n.parent, n.collapsed]),
  edges: view?.edges.map((e) => [e.from, e.to, e.relationships.length]),
});

describe("the C1 Landscape", () => {
  it("shows Persons, Systems and Services outside any System, with edges derived between them", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c1");

    expect(view).toMatchObject({ id: "c1", kind: "c1", title: "C1 Landscape" });
    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, true],
        ["shop:checkout", null, true],
        ["shop:events", null, false],
        ["shop:shopper", null, false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:checkout", "payments:payments", 3],
        ["shop:shopper", "shop:web", 1],
        ["shop:web", "shop:checkout", 1],
      ],
    });
  });

  it("flags External Elements", async () => {
    const { bundle } = await loadWorkspace(elementTreeWorkspace);
    const view = resolveView(bundle, "c1");

    expect(view?.nodes.map((n) => [n.id, n.kind, n.name, n.external])).toEqual([
      ["shop:checkout", "system", "Checkout", false],
      ["shop:psp", "system", "Payment provider", true],
      ["shop:shopper", "person", "Shopper", false],
      ["shop:web", "service", "Web", false],
    ]);
  });
});

describe("the C2 Landscape", () => {
  it("starts with every System collapsed", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c2");

    expect(view).toMatchObject({ id: "c2", kind: "c2", title: "C2 Landscape" });
    expect(shape(view)).toEqual(shape(resolveView(bundle, "c1")));
  });

  it("opens the Systems it is asked to expand, deriving edges to their Services", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c2", { expand: ["shop:checkout"] });

    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, true],
        ["shop:cart", "shop:checkout", true],
        ["shop:cart-db", "shop:checkout", false],
        ["shop:checkout", null, false],
        ["shop:events", null, false],
        ["shop:order-history", "shop:checkout", false],
        ["shop:shopper", null, false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:cart", "payments:payments", 2],
        ["shop:cart", "shop:cart-db", 1],
        ["shop:order-history", "payments:payments", 1],
        ["shop:shopper", "shop:web", 1],
        ["shop:web", "shop:cart", 1],
      ],
    });
  });

  it("opens a Service with Components once its System is open, and ignores it while the System is closed", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const open = resolveView(bundle, "c2", { expand: ["shop:checkout", "shop:cart"] });
    const closed = resolveView(bundle, "c2", { expand: ["shop:cart"] });

    expect(open?.nodes.filter((n) => n.parent === "shop:cart").map((n) => n.id)).toEqual(["shop:checkout-ui"]);
    expect(open?.nodes.find((n) => n.id === "shop:cart")?.collapsed).toBe(false);
    expect(open?.edges.map((e) => [e.from, e.to])).toContainEqual(["shop:checkout-ui", "payments:payments"]);
    expect(shape(closed)).toEqual(shape(resolveView(bundle, "c2")));
  });
});

describe("C2 per System", () => {
  it("shows the System's Services in it, and each neighbour collapsed to its top-level Element", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c2/shop:checkout");

    expect(view).toMatchObject({ id: "c2/shop:checkout", kind: "c2", title: "Checkout (C2)" });
    // The shopper only reaches web, outside the focus, so it is not a neighbour.
    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, true],
        ["shop:cart", "shop:checkout", true],
        ["shop:cart-db", "shop:checkout", false],
        ["shop:checkout", null, false],
        ["shop:order-history", "shop:checkout", false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:cart", "payments:payments", 2],
        ["shop:cart", "shop:cart-db", 1],
        ["shop:order-history", "payments:payments", 1],
        ["shop:web", "shop:cart", 1],
      ],
    });
  });

  it("does not exist for an Element that is not a System", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    expect(resolveView(bundle, "c2/shop:cart")).toBeUndefined();
    expect(resolveView(bundle, "c2/shop:nope")).toBeUndefined();
  });
  it("opens its Services with Components when asked to expand them", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c2/shop:checkout", { expand: ["shop:cart"] });

    expect(view?.nodes.filter((n) => n.parent === "shop:cart").map((n) => n.id)).toEqual(["shop:checkout-ui"]);
    expect(view?.edges.map((e) => [e.from, e.to])).toContainEqual(["shop:checkout-ui", "payments:payments"]);
  });
});

describe("C3 per Service", () => {
  it("shows the Service's Components, keeping a neighbour in the same System at Service level", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c3/shop:cart");

    expect(view).toMatchObject({ id: "c3/shop:cart", kind: "c3", title: "Cart (C3)" });
    // cart-db shares the Checkout System with cart, so Checkout can't separate them; payments-api's System can.
    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, true],
        ["shop:cart", null, false],
        ["shop:cart-db", null, false],
        ["shop:checkout-ui", "shop:cart", false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:cart", "shop:cart-db", 1],
        ["shop:checkout-ui", "payments:payments", 2],
        ["shop:web", "shop:cart", 1],
      ],
    });
  });

  it("collapses neighbours from another System to that System", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c3/payments:payments-api");

    expect(shape(view)).toEqual({
      nodes: [
        ["payments:charges", "payments:payments-api", false],
        ["payments:payments-api", null, false],
        ["shop:checkout", null, true],
      ],
      edges: [["shop:checkout", "payments:charges", 3]],
    });
  });

  it("exists only for Services that declare Components", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    expect(resolveView(bundle, "c3/shop:web")).toBeUndefined();
    expect(resolveView(bundle, "c3/shop:checkout")).toBeUndefined();
  });
});

describe("listing Generated Views", () => {
  it("lists every scope: the two Landscapes, C2 per System and C3 per Service with Components", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);

    expect(listViews(bundle).map((v) => [v.id, v.kind, v.title])).toEqual([
      ["c1", "c1", "C1 Landscape"],
      ["c2", "c2", "C2 Landscape"],
      ["c2/payments:payments", "c2", "Payments (C2)"],
      ["c2/shop:checkout", "c2", "Checkout (C2)"],
      ["c3/payments:payments-api", "c3", "Payments API (C3)"],
      ["c3/shop:cart", "c3", "Cart (C3)"],
    ]);
    expect(listViews(bundle, { kind: "c3" }).map((v) => v.id)).toEqual(["c3/payments:payments-api", "c3/shop:cart"]);
  });

  it("lists the Views that contain an Element as a node", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);

    expect(listViews(bundle, { element: "shop:cart-db" }).map((v) => v.id)).toEqual(["c2/shop:checkout", "c3/shop:cart"]);
    expect(listViews(bundle, { element: "shop:web" }).map((v) => v.id)).toEqual(["c1", "c2", "c2/shop:checkout", "c3/shop:cart"]);
    expect(listViews(bundle, { element: "payments:charges" }).map((v) => v.id)).toEqual(["c3/payments:payments-api"]);
  });
});

describe("the oversized-view warning", () => {
  const services = (n: number) => Array.from({ length: n }, (_, i) => `      s${i + 1}: { name: S${i + 1} }\n`).join("");
  const workspace = (systemServices: number, topLevel = 0) => ({
    "workspace.yaml": "teams:\n  core:\n    name: Core\n",
    "shop/project.yaml": "id: shop\nname: Shop\nowner: core\n",
    "shop/model.yaml":
      `systems:\n  big:\n    name: Big\n    services:\n${services(systemServices)}` +
      (topLevel ? `services:\n${services(topLevel).replace(/ {6}s/g, "  t")}` : ""),
  });

  it("is reported at the System when its C2 View has more than 150 nodes", async () => {
    const over = await loadWorkspace(workspace(150));
    expect(over.issues).toEqual([
      {
        file: "archidocs/shop/model.yaml",
        line: 2,
        rule: "oversized-view",
        severity: "warning",
        message: 'Generated View "c2/shop:big" has 151 nodes, more than the 150 a diagram stays readable at',
      },
    ]);
    expect((await loadWorkspace(workspace(149))).issues).toEqual([]);
  });

  it("is reported at workspace.yaml for the Landscapes", async () => {
    const { issues } = await loadWorkspace(workspace(1, 150));
    expect(issues.map((i) => [i.file, i.line, i.message])).toEqual([
      ["archidocs/workspace.yaml", 1, 'Generated View "c1" has 151 nodes, more than the 150 a diagram stays readable at'],
      ["archidocs/workspace.yaml", 1, 'Generated View "c2" has 151 nodes, more than the 150 a diagram stays readable at'],
    ]);
  });
});

describe("a Lens over a Generated View", () => {
  const marks = (view: ReturnType<typeof resolveView>) => Object.fromEntries(view!.nodes.map((n) => [n.id, n.mark]));
  const lit = (view: ReturnType<typeof resolveView>) => view!.edges.filter((e) => e.lit).map((e) => [e.from, e.to]);

  it("marks the open boxes it is given with impact distances, lighting only edges one hop closer to the origin", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c2", { expand: ["shop:checkout"], lens: { impact: "shop:cart", direction: "upstream" } });

    expect(view?.lens).toEqual({ impact: "shop:cart", direction: "upstream" });
    expect(marks(view)).toMatchObject({
      "shop:cart": { hit: true, distance: 0 },
      "shop:web": { hit: true, distance: 1 },
      "shop:shopper": { hit: true, distance: 2 },
      "shop:cart-db": { hit: false },
      "payments:payments": { hit: false },
    });
    expect(lit(view)).toEqual([
      ["shop:shopper", "shop:web"],
      ["shop:web", "shop:cart"],
    ]);
  });

  it("marks a collapsed box when anything inside it is hit, with the nearest distance", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c2", { lens: { impact: "shop:cart", direction: "upstream" } });

    expect(marks(view)).toMatchObject({ "shop:checkout": { hit: true, distance: 0 }, "payments:payments": { hit: false } });
  });

  it("a Team Lens rings what the Team owns in C3", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const view = resolveView(bundle, "c3/shop:cart", { lens: { team: "payments-team" } });

    expect(marks(view)).toMatchObject({ "shop:checkout-ui": { hit: false }, "payments:payments": { hit: true } });
  });

  it("leaves nodes unmarked without a Lens", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    expect(resolveView(bundle, "c2")!.nodes.every((n) => n.mark === undefined)).toBe(true);
  });
});
