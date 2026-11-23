import { describe, expect, it } from "vitest";
import { getImpact } from "../../src/core/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

type Ring = { distance: number; elements: { id: string; owner: string; relationships: { id: string | null; description: string | null }[] }[] };
const rings = (impact: Ring[]) => impact.map((r) => [r.distance, r.elements.map((e) => e.id)]);

describe("getImpact", () => {
  it("groups the transitive upstream set by distance, including descendants' Relationships", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const { upstream } = getImpact(bundle, "payments:payments-api", "upstream");

    expect(rings(upstream!)).toEqual([
      [1, ["shop:cart", "shop:fraud-check", "shop:order-history"]],
      [2, ["shop:web"]],
      [3, ["shop:shopper"]],
    ]);
    const cart = upstream![0]!.elements[0]!;
    expect(cart.owner).toBe("storefront-team");
    expect(cart.relationships.map((r) => r.id)).toEqual(["shop:authorise", "shop:capture"]);
    expect(upstream![0]!.elements[1]!.owner).toBe("payments-team");
  });

  it("counts a `via` broker as a dependency of both the subscriber and the publisher", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    expect(rings(getImpact(bundle, "shop:events", "upstream").upstream!)).toEqual([
      [1, ["payments:payments-api", "shop:order-history"]],
      [2, ["shop:cart", "shop:fraud-check"]],
      [3, ["shop:web"]],
      [4, ["shop:shopper"]],
    ]);
    expect(rings(getImpact(bundle, "payments:payments-api", "downstream").downstream!)).toEqual([[1, ["shop:events"]]]);
  });

  it("goes both ways and stops at max_depth", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const impact = getImpact(bundle, "shop:cart", "both", { maxDepth: 1 });

    expect(rings(impact.upstream!)).toEqual([[1, ["shop:web"]]]);
    expect(rings(impact.downstream!)).toEqual([[1, ["payments:payments-api", "shop:cart-db"]]]);
  });
});
