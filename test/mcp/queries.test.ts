import { describe, expect, it } from "vitest";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";

type Rel = { id: string | null; description: string | null };
type Hop = { from: string; to: string; relationships: Rel[] };
type Ring = { distance: number; elements: { id: string; owner: string; relationships: Rel[] }[] };
const route = (p: { hops: Hop[] }) => [p.hops[0]!.from, ...p.hops.map((h) => h.to)];
const rings = (side: { rings: Ring[] }) => side.rings.map((r) => [r.distance, r.elements.map((e) => [e.id, e.owner])]);

describe("persona questions", () => {
  it("Enterprise Architect: how are two Services connected?", async () => {
    const { call, text } = await connect(landscapeWorkspace);

    const result = await call("find_paths", { from: "shop:web", to: "payments:payments-api" });

    expect(result.isError).toBeFalsy();
    const { direct, paths, total, truncated } = result.structuredContent as { direct: unknown[]; paths: { hops: Hop[] }[]; total: number; truncated: boolean };
    expect(direct).toEqual([]);
    expect({ total, truncated }).toEqual({ total: 1, truncated: false });
    expect(paths.map(route)).toEqual([["shop:web", "shop:cart", "payments:payments-api"]]);
    expect(paths[0]!.hops.map((h) => h.relationships.map((r) => r.id ?? r.description))).toEqual([["Manages the cart"], ["shop:authorise", "shop:capture"]]);
    expect(text(result)).toBe(
      [
        "shop:web and payments:payments-api: no direct Relationships; 1 shortest path within 4 hops.",
        "- 2 hops: shop:web → shop:cart → payments:payments-api",
      ].join("\n"),
    );
  });

  it("Product Owner: what is upstream and downstream of an outage?", async () => {
    const { call, text } = await connect(landscapeWorkspace);

    const result = await call("get_impact", { id: "payments:payments-api", direction: "both" });

    expect(result.isError).toBeFalsy();
    const { upstream, downstream } = result.structuredContent as { upstream: { total: number; rings: Ring[] }; downstream: { total: number; rings: Ring[] } };
    expect(rings(upstream)).toEqual([
      [1, [["shop:cart", "storefront-team"], ["shop:fraud-check", "payments-team"], ["shop:order-history", "storefront-team"]]],
      [2, [["shop:web", "storefront-team"]]],
      [3, [["shop:shopper", "storefront-team"]]],
    ]);
    expect(upstream.total).toBe(5);
    expect(upstream.rings[0]!.elements[0]!.relationships.map((r) => r.id)).toEqual(["shop:authorise", "shop:capture"]);
    expect(rings(downstream)).toEqual([[1, [["shop:events", "storefront-team"]]]]);
    expect(text(result)).toBe(
      [
        "Impact of payments:payments-api (Payments API): 5 upstream, 1 downstream.",
        "Upstream:",
        "- 1: shop:cart (storefront-team), shop:fraud-check (payments-team), shop:order-history (storefront-team)",
        "- 2: shop:web (storefront-team)",
        "- 3: shop:shopper (storefront-team)",
        "Downstream:",
        "- 1: shop:events (storefront-team)",
      ].join("\n"),
    );
  });

  it("Developer: what does my Team own?", async () => {
    const { call, text } = await connect(landscapeWorkspace);

    const result = await call("list_owned", { team: "payments-team" });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      team: "payments-team",
      kind: null,
      total: 4,
      truncated: false,
      groups: [
        { kind: "system", total: 1, items: [{ id: "payments:payments", name: "Payments", parent: null, upstreamTeams: 1, downstreamTeams: 1 }] },
        {
          kind: "service",
          total: 2,
          items: [
            { id: "payments:payments-api", name: "Payments API", parent: "payments:payments", upstreamTeams: 1, downstreamTeams: 1 },
            { id: "shop:fraud-check", name: "Fraud check", parent: "shop:checkout", upstreamTeams: 0, downstreamTeams: 0 },
          ],
        },
        { kind: "component", total: 1, items: [{ id: "payments:charges", name: "Charges", parent: "payments:payments-api", upstreamTeams: 1, downstreamTeams: 1 }] },
      ],
    });
    expect(text(result)).toBe(
      [
        "payments-team (Payments) owns 4 items.",
        "System:",
        "- payments:payments (Payments): 1 upstream Team, 1 downstream Team",
        "Service:",
        "- payments:payments-api (Payments API): 1 upstream Team, 1 downstream Team",
        "- shop:fraud-check (Fraud check), in shop:checkout: 0 upstream Teams, 0 downstream Teams",
        "Component:",
        "- payments:charges (Charges): 1 upstream Team, 1 downstream Team",
      ].join("\n"),
    );
  });
});

describe("find_paths", () => {
  it("finds a path through an async `via` broker, counting the broker as a hop", async () => {
    const { call, text } = await connect(landscapeWorkspace);

    const result = await call("find_paths", { from: "shop:order-history", to: "payments:payments-api" });

    const { direct, paths } = result.structuredContent as { direct: { from: string; to: string; derived: boolean }[]; paths: { hops: Hop[] }[] };
    expect(direct.map((d) => [d.from, d.to, d.derived])).toEqual([["shop:order-history", "payments:payments-api", true]]);
    expect(paths.map(route)).toEqual([["shop:order-history", "shop:events", "payments:payments-api"]]);
    expect(text(result)).toContain("- direct shop:order-history → payments:payments-api (derived): Payment events");
    expect(text(result)).toContain("- 2 hops: shop:order-history → shop:events → payments:payments-api");
  });

  it("honours max_hops and limit", async () => {
    // admin reaches payments-api both through cart and through fraud-check.
    const { call } = await connect({
      ...landscapeWorkspace,
      "shop/admin.yaml": "services:\n  admin:\n    name: Admin\n    relationships:\n      - to: cart\n      - to: fraud-check\n",
    });

    expect((await call("find_paths", { from: "shop:shopper", to: "payments:payments-api", max_hops: 2 })).structuredContent).toMatchObject({ maxHops: 2, total: 0, paths: [] });
    const limited = await call("find_paths", { from: "shop:admin", to: "payments:payments-api", limit: 1 });
    expect(limited.structuredContent).toMatchObject({ total: 2, truncated: true });
  });

  it("gives not_found for an unknown Element and invalid_input for the same Element twice", async () => {
    const { call } = await connect(landscapeWorkspace);

    expect((await call("find_paths", { from: "shop:crt", to: "shop:web" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop:cart"] });
    expect((await call("find_paths", { from: "shop:web", to: "shop:web" })).structuredContent).toMatchObject({ code: "invalid_input" });
  });
});

describe("get_impact", () => {
  it("goes one way, stops at max_depth and truncates to limit", async () => {
    const { call } = await connect(landscapeWorkspace);

    const result = await call("get_impact", { id: "payments:payments-api", direction: "upstream", max_depth: 1, limit: 2 });

    const content = result.structuredContent as { maxDepth: number; upstream: { total: number; truncated: boolean; rings: Ring[] }; downstream?: unknown };
    expect(content.maxDepth).toBe(1);
    expect(content.downstream).toBeUndefined();
    expect(content.upstream.total).toBe(3);
    expect(content.upstream.truncated).toBe(true);
    expect(rings(content.upstream)).toEqual([[1, [["shop:cart", "storefront-team"], ["shop:fraud-check", "payments-team"]]]]);
  });

  it("gives not_found for an unknown Element", async () => {
    const { call } = await connect(landscapeWorkspace);
    expect((await call("get_impact", { id: "payments:api", direction: "upstream" })).structuredContent).toMatchObject({ code: "not_found" });
  });
});

describe("list_owned", () => {
  it("lists Deployment Targets and narrows by kind", async () => {
    const { call } = await connect(landscapeWorkspace);

    const targets = await call("list_owned", { team: "platform-team", kind: "target" });
    expect(targets.structuredContent).toMatchObject({ kind: "target", total: 2, groups: [{ kind: "target", items: [{ id: "platform:aws-eu" }, { id: "platform:eks-prod" }] }] });
  });

  it("truncates to limit across groups", async () => {
    const { call } = await connect(landscapeWorkspace);

    const result = await call("list_owned", { team: "storefront-team", limit: 3 });
    expect(result.structuredContent).toMatchObject({ total: 8, truncated: true });
    expect((result.structuredContent!.groups as { kind: string; total: number; items: unknown[] }[]).map((g) => [g.kind, g.total, g.items.length])).toEqual([
      ["person", 1, 1],
      ["system", 1, 1],
      ["service", 5, 1],
    ]);
  });

  it("gives not_found for an unknown Team", async () => {
    const { call } = await connect(landscapeWorkspace);
    expect((await call("list_owned", { team: "payment-team" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["payments-team"] });
  });
});

describe("get_element Relationships", () => {
  it("returns declared Relationships in and out and the derived edges", async () => {
    const { call, text } = await connect(landscapeWorkspace);

    const cart = await call("get_element", { id: "shop:cart" });
    const content = cart.structuredContent as {
      relationships: { in: Rel[]; out: Rel[] };
      derived: { in: { from: string; to: string }[]; out: { from: string; to: string; relationships: Rel[] }[] };
    };
    expect(content.relationships.out.map((r) => r.description)).toEqual(["Reads and writes carts"]);
    expect(content.relationships.in.map((r) => r.description)).toEqual(["Manages the cart"]);
    expect(content.derived.out.map((e) => [e.from, e.to, e.relationships.map((r) => r.id)])).toEqual([["shop:cart", "payments:payments-api", ["shop:authorise", "shop:capture"]]]);
    expect(content.derived.in).toEqual([]);
    expect(text(cart)).toContain("- uses: shop:cart-db (Reads and writes carts)");
    expect(text(cart)).toContain("- used by: shop:web (Manages the cart)");
    expect(text(cart)).toContain("- derived: → payments:payments-api (2 Relationships)");
  });
});
