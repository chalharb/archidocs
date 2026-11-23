import { describe, expect, it } from "vitest";
import { listViews, resolveView } from "../../src/core/index.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";

/** The landscape fixture plus `views: structural:` in the shop Project, given as YAML under it. */
const withViews = (views: string, extra: Files = {}): Files => ({
  ...landscapeWorkspace,
  "shop/views.yaml": `views:\n  structural:\n${views.replace(/^/gm, "    ")}\n`,
  ...extra,
});

/** A View's nodes as `[id, parent, collapsed]` and edges as `[from, to]`, for compact assertions. */
const shape = (view: ReturnType<typeof resolveView>) => ({
  nodes: view?.nodes.map((n) => [n.id, n.parent, n.collapsed]),
  edges: view?.edges.map((e) => [e.from, e.to]),
});

const nodeIds = (view: ReturnType<typeof resolveView>) => view?.nodes.map((n) => n.id);

async function resolved(views: string, id = "shop:v", extra: Files = {}) {
  const { bundle, issues } = await loadWorkspace(withViews(views, extra));
  return { bundle, issues, view: resolveView(bundle, id) };
}

describe("Saved Views in the Bundle", () => {
  it("holds each definition with every id qualified, and its source", async () => {
    const { bundle, issues } = await loadWorkspace(
      withViews(`checkout-flow:
  title: Checkout flow
  description: How a purchase reaches Payments
  tags: [checkout]
  level: c2
  include:
    - web
    - { element: checkout, with: children, downstream: all }
    - { team: payments-team }
    - { tag: pci }
    - { from: web, to: payments:payments-api, paths: 3 }
  exclude: [cart-db]
  expand: [checkout]
  collapse: [payments:payments]
  direction: TB
  lens: { impact: cart, direction: upstream }`),
    );

    expect(issues).toEqual([]);
    expect(bundle.views).toEqual([
      {
        id: "shop:checkout-flow",
        project: "shop",
        kind: "structural",
        title: "Checkout flow",
        description: "How a purchase reaches Payments",
        tags: ["checkout"],
        level: "c2",
        include: [
          "shop:web",
          { element: "shop:checkout", with: "children", downstream: "all" },
          { team: "payments-team" },
          { tag: "pci" },
          { from: "shop:web", to: "payments:payments-api", paths: 3 },
        ],
        exclude: ["shop:cart-db"],
        expand: ["shop:checkout"],
        collapse: ["payments:payments"],
        direction: "TB",
        lens: { impact: "shop:cart", direction: "upstream" },
        environment: null,
        targets: [],
        source: { file: "archidocs/shop/views.yaml", line: 3 },
      },
    ]);
  });
});

describe("resolving a Saved View", () => {
  it("shows the Elements its bare ids name, with edges derived between them", async () => {
    const { view } = await resolved(`v:
  title: Front door
  level: c2
  include: [shopper, web, cart]`);

    expect(view).toMatchObject({ id: "shop:v", kind: "c2", title: "Front door" });
    expect(shape(view)).toEqual({
      nodes: [
        ["shop:cart", null, true],
        ["shop:shopper", null, false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:shopper", "shop:web"],
        ["shop:web", "shop:cart"],
      ],
    });
  });

  it("collapses every Element to its level", async () => {
    const { view } = await resolved(`v:
  title: Systems
  level: c1
  include: [web, cart, fraud-check, payments:charges]`);

    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, true],
        ["shop:checkout", null, true],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:checkout", "payments:payments"],
        ["shop:web", "shop:checkout"],
      ],
    });
  });

  it("shows every Element when it has no include", async () => {
    const { bundle, view } = await resolved(`v:
  title: Everything
  level: c1`);

    expect(shape(view)).toEqual(shape(resolveView(bundle, "c1")));
  });

  it("is listed beside the Generated Views, with its level as its kind", async () => {
    const { bundle } = await loadWorkspace(withViews(`v:\n  title: Front door\n  level: c2\n  include: [web]`));

    expect(listViews(bundle).at(-1)).toEqual({ id: "shop:v", kind: "c2", title: "Front door" });
    expect(listViews(bundle, { element: "shop:web" }).map((v) => v.id)).toContain("shop:v");
  });
});

describe("selectors", () => {
  it("{element, with: children} adds the Element's children", async () => {
    const { view } = await resolved(`v:\n  title: Checkout\n  level: c2\n  include: [{ element: checkout, with: children }]`);

    expect(shape(view)).toEqual({
      nodes: [
        ["shop:cart", "shop:checkout", true],
        ["shop:cart-db", "shop:checkout", false],
        ["shop:checkout", null, false],
        ["shop:fraud-check", "shop:checkout", false],
        ["shop:order-history", "shop:checkout", false],
      ],
      edges: [["shop:cart", "shop:cart-db"]],
    });
  });

  it("{element, with: descendants} adds everything beneath the Element", async () => {
    const { view } = await resolved(`v:\n  title: Checkout\n  level: c3\n  include: [{ element: checkout, with: descendants }]`);

    expect(nodeIds(view)).toEqual(["shop:cart", "shop:cart-db", "shop:checkout", "shop:checkout-ui", "shop:fraud-check", "shop:order-history"]);
    expect(view?.nodes.find((n) => n.id === "shop:checkout-ui")?.parent).toBe("shop:cart");
  });

  it("{element, upstream: n} adds what depends on the Element within n hops", async () => {
    const { view } = await resolved(`v:\n  title: Cart users\n  level: c2\n  include: [{ element: cart, upstream: 1 }]`);

    expect(nodeIds(view)).toEqual(["shop:cart", "shop:web"]);
  });

  it("{element, upstream: all} adds everything that depends on the Element", async () => {
    const { view } = await resolved(`v:\n  title: Cart users\n  level: c2\n  include: [{ element: cart, upstream: all }]`);

    expect(nodeIds(view)).toEqual(["shop:cart", "shop:shopper", "shop:web"]);
  });

  it("{element, downstream: all} adds everything the Element depends on, as get_impact finds it", async () => {
    const { view } = await resolved(`v:\n  title: Web needs\n  level: c2\n  include: [{ element: web, downstream: all }]`);

    // Payments API receives events through the broker, so it depends on it too.
    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments-api", null, true],
        ["shop:cart", null, true],
        ["shop:cart-db", null, false],
        ["shop:events", null, false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:cart", "payments:payments-api"],
        ["shop:cart", "shop:cart-db"],
        ["shop:web", "shop:cart"],
      ],
    });
  });

  it("counts a via broker as a hop", async () => {
    const { view } = await resolved(`v:\n  title: History needs\n  level: c2\n  include: [{ element: order-history, downstream: 1 }]`);

    expect(nodeIds(view)).toEqual(["payments:payments-api", "shop:events", "shop:order-history"]);
  });

  it("{team} adds every Element the Team owns", async () => {
    const { view } = await resolved(`v:\n  title: Payments team\n  level: c2\n  include: [{ team: payments-team }]`);

    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, false],
        ["payments:payments-api", "payments:payments", true],
        ["shop:fraud-check", null, false],
      ],
      edges: [["shop:fraud-check", "payments:payments-api"]],
    });
  });

  it("{tag} adds every Element carrying the tag", async () => {
    const { view } = await resolved(`v:\n  title: PCI\n  level: c2\n  include: [{ tag: pci }]`, "shop:v", {
      "shop/ledger.yaml": "services:\n  ledger:\n    name: Ledger\n    tags: [pci]\n",
    });

    expect(nodeIds(view)).toEqual(["shop:ledger"]);
  });

  it("{from, to} adds the Elements on the shortest paths between them", async () => {
    const { view } = await resolved(`v:\n  title: Purchase\n  level: c2\n  include: [{ from: shopper, to: payments:payments-api }]`);

    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments-api", null, true],
        ["shop:cart", null, true],
        ["shop:shopper", null, false],
        ["shop:web", null, false],
      ],
      edges: [
        ["shop:cart", "payments:payments-api"],
        ["shop:shopper", "shop:web"],
        ["shop:web", "shop:cart"],
      ],
    });
  });

  it("{from, to, paths: n} adds the Elements on every path of at most n hops", async () => {
    const shortest = await resolved(`v:\n  title: Money\n  level: c1\n  include: [{ from: checkout, to: payments:payments }]`);
    const within2 = await resolved(`v:\n  title: Money\n  level: c1\n  include: [{ from: checkout, to: payments:payments, paths: 2 }]`);

    expect(nodeIds(shortest.view)).toEqual(["payments:payments", "shop:checkout"]);
    expect(nodeIds(within2.view)).toEqual(["payments:payments", "shop:checkout", "shop:events"]);
  });
});

describe("exclude", () => {
  it("subtracts an Element and everything inside it, with their Relationships", async () => {
    const { view } = await resolved(`v:\n  title: Money\n  level: c1\n  include: [checkout, payments:payments]\n  exclude: [cart]`);

    expect(view?.edges.map((e) => [e.from, e.to, e.relationships.map((r) => r.from)])).toEqual([["shop:checkout", "payments:payments", ["shop:fraud-check", "shop:order-history"]]]);
  });

  it("subtracts any selector", async () => {
    const { view } = await resolved(`v:\n  title: Web needs\n  level: c2\n  include: [{ element: web, downstream: all }]\n  exclude: [{ team: payments-team }, cart-db]`);

    expect(nodeIds(view)).toEqual(["shop:cart", "shop:events", "shop:web"]);
  });
});

describe("expand and collapse", () => {
  it("expand opens an Element one level deeper than the View's level", async () => {
    const { view } = await resolved(`v:\n  title: Money\n  level: c1\n  include: [checkout, payments:payments]\n  expand: [checkout]`);

    expect(shape(view)).toEqual({
      nodes: [
        ["payments:payments", null, true],
        ["shop:cart", "shop:checkout", true],
        ["shop:cart-db", "shop:checkout", false],
        ["shop:checkout", null, false],
        ["shop:fraud-check", "shop:checkout", false],
        ["shop:order-history", "shop:checkout", false],
      ],
      edges: [
        ["shop:cart", "payments:payments"],
        ["shop:cart", "shop:cart-db"],
        ["shop:fraud-check", "payments:payments"],
        ["shop:order-history", "payments:payments"],
      ],
    });
  });

  it("collapse closes an Element, keeping others open", async () => {
    const { view } = await resolved(`v:\n  title: Services\n  level: c2\n  collapse: [payments:payments]`);

    expect(nodeIds(view)).toEqual([
      "payments:payments",
      "shop:cart",
      "shop:cart-db",
      "shop:checkout",
      "shop:events",
      "shop:fraud-check",
      "shop:order-history",
      "shop:shopper",
      "shop:web",
    ]);
    expect(view?.nodes.find((n) => n.id === "payments:payments")?.collapsed).toBe(true);
  });
});

describe("the Lens", () => {
  const marks = (view: ReturnType<typeof resolveView>) => Object.fromEntries(view!.nodes.map((n) => [n.id, n.mark]));
  const lit = (view: ReturnType<typeof resolveView>) => view!.edges.filter((e) => e.lit).map((e) => [e.from, e.to]);

  it("never changes which nodes the View holds", async () => {
    const plain = await resolved(`v:\n  title: All\n  level: c2`);
    const lensed = await resolved(`v:\n  title: All\n  level: c2\n  lens: { impact: cart, direction: upstream }`);

    expect(nodeIds(lensed.view)).toEqual(nodeIds(plain.view));
    expect(lensed.view?.lens).toEqual({ impact: "shop:cart", direction: "upstream" });
  });

  it("an impact Lens marks each node hit with its distance, and lights edges one hop closer to the origin", async () => {
    const { view } = await resolved(`v:\n  title: All\n  level: c2\n  lens: { impact: cart, direction: upstream }`);

    expect(marks(view)).toMatchObject({
      "shop:cart": { hit: true, distance: 0 },
      "shop:web": { hit: true, distance: 1 },
      "shop:shopper": { hit: true, distance: 2 },
      "shop:checkout": { hit: false },
      "shop:cart-db": { hit: false },
    });
    expect(lit(view)).toEqual([
      ["shop:shopper", "shop:web"],
      ["shop:web", "shop:cart"],
    ]);
  });

  it("a Team Lens marks owned nodes and collapsed boxes holding anything owned", async () => {
    const { view } = await resolved(`v:\n  title: Systems\n  level: c1\n  lens: { team: payments-team }`);

    expect(marks(view)).toEqual({
      "payments:payments": { hit: true },
      "shop:checkout": { hit: true },
      "shop:events": { hit: false },
      "shop:shopper": { hit: false },
      "shop:web": { hit: false },
    });
    expect(lit(view)).toEqual([["shop:checkout", "payments:payments"]]);
  });

  it("a path Lens marks the nodes on the paths and lights their hops", async () => {
    const { view } = await resolved(`v:\n  title: Systems\n  level: c1\n  lens: { path: { from: web, to: payments:payments-api } }`);

    expect(marks(view)).toEqual({
      "payments:payments": { hit: true },
      "shop:checkout": { hit: true },
      "shop:events": { hit: false },
      "shop:shopper": { hit: false },
      "shop:web": { hit: true },
    });
    expect(lit(view)).toEqual([
      ["shop:checkout", "payments:payments"],
      ["shop:web", "shop:checkout"],
    ]);
  });
});
