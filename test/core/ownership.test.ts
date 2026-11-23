import { describe, expect, it } from "vitest";
import { listOwned } from "../../src/core/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

type Owned = ReturnType<typeof listOwned>;
const grouped = (owned: Owned) => owned.groups.map((g) => [g.kind, g.items.map((i) => i.id)]);

describe("listOwned", () => {
  it("groups a Team's Elements by kind, each with counts of Upstream and Downstream Teams", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const owned = listOwned(bundle, "storefront-team");

    expect(grouped(owned)).toEqual([
      ["person", ["shop:shopper"]],
      ["system", ["shop:checkout"]],
      ["service", ["shop:cart", "shop:cart-db", "shop:events", "shop:order-history", "shop:web"]],
      ["component", ["shop:checkout-ui"]],
    ]);
    expect(owned.total).toBe(8);
    const item = (id: string) => owned.groups.flatMap((g) => g.items).find((i) => i.id === id);
    expect(item("shop:cart")).toEqual({ id: "shop:cart", name: "Cart", parent: "shop:checkout", upstreamTeams: 0, downstreamTeams: 1 });
    // Both the subscriber (storefront) and the publisher (payments) depend on the broker.
    expect(item("shop:events")).toEqual(expect.objectContaining({ upstreamTeams: 1, downstreamTeams: 0 }));
  });

  it("lists an Element owned by another Team than its parent under its own Owner", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    expect(grouped(listOwned(bundle, "payments-team"))).toEqual([
      ["system", ["payments:payments"]],
      ["service", ["payments:payments-api", "shop:fraud-check"]],
      ["component", ["payments:charges"]],
    ]);
    expect(grouped(listOwned(bundle, "storefront-team")).flatMap(([, ids]) => ids)).not.toContain("shop:fraud-check");
  });

  it("lists Deployment Targets, counting the Teams deployed onto them as Upstream", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const owned = listOwned(bundle, "platform-team");

    expect(owned.groups).toEqual([
      {
        kind: "target",
        total: 2,
        items: [
          { id: "platform:aws-eu", name: "AWS eu-west-1", parent: null, upstreamTeams: 2, downstreamTeams: 0 },
          { id: "platform:eks-prod", name: "EKS prod", parent: "platform:aws-eu", upstreamTeams: 2, downstreamTeams: 0 },
        ],
      },
    ]);
  });

  it("narrows to one kind", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    expect(grouped(listOwned(bundle, "payments-team", "component"))).toEqual([["component", ["payments:charges"]]]);
  });
});
