import { describe, expect, it } from "vitest";
import { findPaths } from "../../src/core/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const hops = (path: { hops: { from: string; to: string }[] }) => [path.hops[0]!.from, ...path.hops.map((h) => h.to)];

describe("findPaths", () => {
  it("finds the shortest path between two Services through a derived edge", async () => {
    const { bundle, issues } = await loadWorkspace(landscapeWorkspace);
    expect(issues).toEqual([]);

    const result = findPaths(bundle, "shop:web", "payments:payments-api");

    expect(result.direct).toEqual([]);
    expect(result.paths.map(hops)).toEqual([["shop:web", "shop:cart", "payments:payments-api"]]);
    expect(result.paths[0]!.hops[1]!.relationships.map((r) => r.id)).toEqual(["shop:authorise", "shop:capture"]);
  });

  it("counts a `via` broker as an extra hop", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const result = findPaths(bundle, "shop:order-history", "payments:payments-api");

    expect(result.paths.map(hops)).toEqual([["shop:order-history", "shop:events", "payments:payments-api"]]);
    expect(result.paths[0]!.hops.map((h) => h.relationships.map((r) => r.description))).toEqual([["Payment events"], ["Payment events"]]);
  });

  it("returns the direct Relationships both ways, declared and derived", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const declared = findPaths(bundle, "shop:cart-db", "shop:cart");
    expect(declared.direct.map((d) => [d.from, d.to, d.derived, d.relationships.map((r) => r.description)])).toEqual([
      ["shop:cart", "shop:cart-db", false, ["Reads and writes carts"]],
    ]);
    expect(declared.paths.map(hops)).toEqual([["shop:cart", "shop:cart-db"]]);

    const derived = findPaths(bundle, "shop:cart", "payments:payments-api");
    expect(derived.direct.map((d) => [d.from, d.to, d.derived, d.relationships.map((r) => r.id)])).toEqual([
      ["shop:cart", "payments:payments-api", true, ["shop:authorise", "shop:capture"]],
    ]);
  });

  it("compares at the levels of the two Elements given", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const result = findPaths(bundle, "shop:checkout", "payments:payments");

    expect(result.direct.map((d) => [d.from, d.to, d.relationships.length])).toEqual([["shop:checkout", "payments:payments", 4]]);
    expect(result.paths.map(hops)).toEqual([["shop:checkout", "payments:payments"]]);
  });

  it("stops at max_hops", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    expect(findPaths(bundle, "shop:shopper", "payments:payments-api").paths.map(hops)).toEqual([
      ["shop:shopper", "shop:web", "shop:cart", "payments:payments-api"],
    ]);
    expect(findPaths(bundle, "shop:shopper", "payments:payments-api", { maxHops: 2 }).paths).toEqual([]);
  });
});
