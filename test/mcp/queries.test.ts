import { describe, expect, it } from "vitest";
import { listGaps } from "../../src/core/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";
import { connect } from "../support/mcp.ts";

type Rel = { id: string | null; description: string | null };
type Hop = { from: string; to: string; relationships: Rel[] };
type Ring = { distance: number; elements: { id: string; owner: string; relationships: Rel[] }[] };
const route = (p: { hops: Hop[] }) => [p.hops[0]!.from, ...p.hops.map((h) => h.to)];
const rings = (side: { rings: Ring[] }) => side.rings.map((r) => [r.distance, r.elements.map((e) => [e.id, e.owner])]);

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

describe("list_gaps", () => {
  it("returns the same gaps as the core scan, with the Markdown list as text", async () => {
    const { call, text } = await connect(landscapeWorkspace);
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const result = await call("list_gaps", {});

    const expected = listGaps(bundle);
    expect(result.structuredContent).toEqual({ total: expected.length, gaps: expected });
    expect(text(result)).toContain("## shop\n### payments-team\n- service shop:fraud-check: description, technology, repository, deployments\n");
  });

  it("narrows to a Project and an Owner Team", async () => {
    const { call } = await connect(landscapeWorkspace);
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const result = await call("list_gaps", { project: "shop", owner: "payments-team" });

    expect((result.structuredContent as { gaps: unknown[] }).gaps).toEqual(listGaps(bundle, { project: "shop", owner: "payments-team" }));
  });

  it("says so when there are no gaps", async () => {
    const { call, text } = await connect(landscapeWorkspace);
    const result = await call("list_gaps", { project: "platform" });
    expect(result.structuredContent).toEqual({ total: 0, gaps: [] });
    expect(text(result)).toBe("No gaps.");
  });

  it("gives not_found for an unknown Project or Team", async () => {
    const { call } = await connect(landscapeWorkspace);
    expect((await call("list_gaps", { project: "shp" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop"] });
    expect((await call("list_gaps", { owner: "payment-team" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["payments-team"] });
  });
});
