import { describe, expect, it } from "vitest";
import { deploymentWorkspace, landscapeWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";

type Rel = { id: string | null; description: string | null };
type Hop = { from: string; to: string; relationships: Rel[] };
type Ring = { distance: number; elements: { id: string; owner: string; relationships: Rel[] }[] };
const route = (p: { hops: Hop[] }) => [p.hops[0]!.from, ...p.hops.map((h) => h.to)];
const rings = (side: { rings: Ring[] }) => side.rings.map((r) => [r.distance, r.elements.map((e) => [e.id, e.owner])]);

/** Acceptance tests: each persona question answered through MCP, as an agent would. */
describe("persona questions through MCP", () => {
  it("Solutions Architect: where is a Service deployed?", async () => {
    const { call } = await connect(deploymentWorkspace);

    const found = await call("search_elements", { query: "Web", kind: "service" });
    const [web] = found.structuredContent!.elements as { id: string }[];
    const result = await call("get_deployments", { service: web!.id });

    const where = (result.structuredContent!.deployments as { environment: string; targetPath: { name: string }[] }[]).map(
      (d) => `${d.environment}: ${d.targetPath.map((t) => t.name).join(" › ")}`,
    );
    expect(where).toEqual(["prod: AWS eu-west-1 › EKS prod", "prod: Shop edge", "staging: AWS eu-west-1 › EKS staging"]);
  });

  it("QA Tester: what is a Service's URL in staging?", async () => {
    const { call, text } = await connect(deploymentWorkspace);

    const result = await call("get_deployments", { service: "shop:web", environment: "staging" });

    expect((result.structuredContent!.deployments as { url: string | null }[]).map((d) => d.url)).toEqual(["https://staging.shop.example.com"]);
    expect(text(result)).toContain("https://staging.shop.example.com");
  });

  it("QA Tester: which Service is behind this URL?", async () => {
    const { call } = await connect(deploymentWorkspace);

    const result = await call("search_elements", { query: "https://shop.example.com/healthz" });

    expect(result.structuredContent!.elements).toEqual([
      expect.objectContaining({ id: "shop:web", deployment: { environment: "prod", target: "platform:eks-prod", url: "https://shop.example.com/healthz" } }),
    ]);
  });

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
