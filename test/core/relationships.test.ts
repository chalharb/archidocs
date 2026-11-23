import { describe, expect, it } from "vitest";
import { deriveEdges } from "../../src/core/index.ts";
import { loadWorkspace } from "../support/workspace.ts";
import { relationshipWorkspace } from "../support/fixtures.ts";

describe("declared Relationships", () => {
  it("are stored in the Bundle by consumer → provider, with qualified ids and defaults", async () => {
    const { bundle, issues } = await loadWorkspace(relationshipWorkspace);

    expect(issues).toEqual([]);
    expect(bundle.relationships.find((r) => r.from === "shop:shopper")).toEqual({
      id: null,
      from: "shop:shopper",
      to: "shop:web",
      description: "Browses and buys",
      technology: "HTTPS",
      interaction: "sync",
      via: null,
      channel: null,
      tags: [],
      source: { file: "archidocs/shop/people.yaml", line: 5 },
    });
    expect(bundle.relationships.find((r) => r.via !== null)).toEqual(
      expect.objectContaining({ from: "shop:order-history", to: "payments:charges", interaction: "async", via: "shop:events", channel: "payment.captured" }),
    );
  });

  it("keeps several Relationships on one pair distinct", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const pair = bundle.relationships.filter((r) => r.from === "shop:checkout-ui" && r.to === "payments:charges");

    expect(pair.map((r) => [r.id, r.description])).toEqual([
      ["shop:authorise", "Authorises a card"],
      ["shop:capture", "Captures a payment"],
    ]);
  });
});

describe("derived edges", () => {
  it("lift Component-level Relationships to Service edges, carrying the Relationships beneath them", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const edges = deriveEdges(bundle, "service");

    expect(edges.map((e) => [e.from, e.to, e.relationships.map((r) => r.id ?? r.description)])).toEqual([
      ["shop:cart", "payments:payments-api", ["shop:authorise", "shop:capture"]],
      ["shop:cart", "shop:cart-db", ["Reads and writes carts"]],
      ["shop:order-history", "payments:payments-api", ["Payment events"]],
      ["shop:shopper", "shop:web", ["Browses and buys"]],
      ["shop:web", "shop:cart", ["Manages the cart"]],
    ]);
  });

  it("lift them to System edges, dropping an edge that collapses onto one node", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const edges = deriveEdges(bundle, "system");

    // cart → cart-db and order-history → … sit inside checkout or outside any System as noted.
    expect(edges.map((e) => [e.from, e.to, e.relationships.length])).toEqual([
      ["shop:checkout", "payments:payments", 3],
      ["shop:shopper", "shop:web", 1],
      ["shop:web", "shop:checkout", 1],
    ]);
  });

  it("at Component level, keep each declared Relationship's own ends", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const edges = deriveEdges(bundle, "component");

    expect(edges.find((e) => e.from === "shop:checkout-ui")).toEqual(
      expect.objectContaining({ to: "payments:charges", relationships: [expect.objectContaining({ id: "shop:authorise" }), expect.objectContaining({ id: "shop:capture" })] }),
    );
  });
});

describe("Relationship references", () => {
  const issuesOf = async (path: string, yaml: string) =>
    (await loadWorkspace({ ...relationshipWorkspace, [path]: yaml })).issues.map((i) => [i.file, i.line, i.rule, i.message]);

  it("report a misspelt `project:id` with the nearest id", async () => {
    expect(await issuesOf("shop/admin.yaml", "services:\n  admin:\n    name: Admin\n    relationships:\n      - to: paymnts:charges\n")).toEqual([
      ["archidocs/shop/admin.yaml", 5, "unknown-project", 'Unknown Project "paymnts" in "paymnts:charges"; did you mean "payments:charges"?'],
    ]);
    expect(await issuesOf("shop/admin.yaml", "services:\n  admin:\n    name: Admin\n    relationships:\n      - to: payments:charge\n")).toEqual([
      ["archidocs/shop/admin.yaml", 5, "unknown-element", 'Unknown Element "charge" in Project "payments"; did you mean "payments:charges"?'],
    ]);
  });

  it("suggest a bare id for a misspelt id in the consumer's own Project", async () => {
    expect(await issuesOf("shop/admin.yaml", "services:\n  admin:\n    name: Admin\n    relationships:\n      - to: crat\n")).toEqual([
      ["archidocs/shop/admin.yaml", 5, "unknown-element", 'Unknown Element "crat" in Project "shop"; did you mean "cart"?'],
    ]);
  });

  it("report a Project qualifying its own ids, and still resolve them", async () => {
    const { bundle, issues } = await loadWorkspace({
      ...relationshipWorkspace,
      "shop/admin.yaml": "services:\n  admin:\n    name: Admin\n    relationships:\n      - to: shop:cart\n",
    });
    expect(issues.map((i) => [i.line, i.rule, i.message])).toEqual([[5, "own-project-prefix", 'Write "cart", not "shop:cart", inside Project "shop"']]);
    expect(bundle.relationships).toContainEqual(expect.objectContaining({ from: "shop:admin", to: "shop:cart" }));
  });

  it("report `via` naming an Element that isn't a Service as wrong-kind, not via-not-broker", async () => {
    expect(
      await issuesOf("shop/admin.yaml", "services:\n  admin:\n    name: Admin\n    relationships:\n      - to: cart\n        interaction: async\n        via: checkout\n"),
    ).toEqual([["archidocs/shop/admin.yaml", 7, "wrong-kind", '`via` must name a broker Service, but "checkout" is a System']]);
  });
});
