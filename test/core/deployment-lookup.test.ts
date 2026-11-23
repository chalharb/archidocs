import { describe, expect, it } from "vitest";
import { getDeployments, search } from "../../src/core/index.ts";
import { deploymentWorkspace, relationshipWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

describe("getDeployments", () => {
  it("lists a Service's Deployments with Environment, the full Deployment Target chain, url and endpoints", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    const deployments = getDeployments(bundle, "shop:web");

    expect(deployments.map((d) => [d.environment, d.targetPath.map((t) => t.id), d.url])).toEqual([
      ["prod", ["platform:aws-eu", "platform:eks-prod"], "https://shop.example.com"],
      ["prod", ["shop:shop-edge"], null],
      ["staging", ["platform:aws-eu", "platform:eks-staging"], "https://staging.shop.example.com"],
    ]);
    expect(deployments[0]).toEqual({
      service: "shop:web",
      environment: "prod",
      target: "platform:eks-prod",
      targetPath: [
        { id: "platform:aws-eu", name: "AWS eu-west-1", kind: "region" },
        { id: "platform:eks-prod", name: "EKS prod", kind: "cluster" },
      ],
      url: "https://shop.example.com",
      endpoints: [{ name: "health", url: "https://shop.example.com/healthz" }],
      owner: "storefront-team",
      source: { file: "archidocs/shop/model.yaml", line: 10 },
    });
  });

  it("narrows to one Environment", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    expect(getDeployments(bundle, "shop:web", "staging").map((d) => [d.target, d.url])).toEqual([
      ["platform:eks-staging", "https://staging.shop.example.com"],
    ]);
  });

  it("is empty for a Service with no Deployments", async () => {
    const { bundle } = await loadWorkspace({
      ...deploymentWorkspace,
      "shop/more.yaml": "services:\n  cart:\n    name: Cart\n",
    });

    expect(getDeployments(bundle, "shop:cart")).toEqual([]);
  });
});

describe("search", () => {
  const ids = (matches: ReturnType<typeof search>) => matches.map((m) => m.element.id);

  it("still matches ids and names, exact first", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    expect(ids(search(bundle, "web"))).toEqual(["shop:web"]);
    expect(ids(search(bundle, "payments api"))).toEqual(["payments:payments-api"]);
  });

  it("finds the Service from a Deployment's url, saying which Deployment matched", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    expect(search(bundle, "https://staging.shop.example.com")).toEqual([
      expect.objectContaining({
        element: expect.objectContaining({ id: "shop:web" }),
        deployment: { environment: "staging", target: "platform:eks-staging", url: "https://staging.shop.example.com" },
      }),
    ]);
  });

  it("finds the Service from a host, a trailing slash, another case or a deeper path", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    for (const query of ["staging.shop.example.com", "https://staging.shop.example.com/", "HTTPS://Staging.Shop.Example.com", "https://staging.shop.example.com/cart?id=1"]) {
      expect(search(bundle, query).map((m) => [m.element.id, m.deployment?.environment]), query).toEqual([["shop:web", "staging"]]);
    }
  });

  it("finds the Service from an endpoint's url", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    expect(search(bundle, "https://shop.example.com/healthz").map((m) => [m.element.id, m.deployment])).toEqual([
      ["shop:web", { environment: "prod", target: "platform:eks-prod", url: "https://shop.example.com/healthz" }],
    ]);
  });

  it("does not match a host by a mere suffix of another host", async () => {
    const { bundle } = await loadWorkspace(deploymentWorkspace);

    expect(ids(search(bundle, "https://evil-shop.example.com"))).toEqual([]);
  });

  it("matches technology and Team only when asked, as the viewer's Find does", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    const find = (q: string) => ids(search(bundle, q, { fields: ["team", "technology"] }));

    expect(ids(search(bundle, "kafka"))).toEqual([]);
    expect(find("kafka")).toEqual(["shop:events"]);
    expect(find("Storefront")).toEqual(["shop:cart", "shop:cart-db", "shop:checkout", "shop:checkout-ui", "shop:events", "shop:order-history", "shop:shopper", "shop:web"]);
    expect(find("payments-team")).toEqual(["payments:charges", "payments:payments", "payments:payments-api"]);
  });

  it("ranks a Team or technology match after any name or id match", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);

    const ranks = search(bundle, "Storefront", { fields: ["team", "technology"] }).map((m) => m.rank);
    expect(new Set(ranks)).toEqual(new Set([2]));
    expect(search(bundle, "kafka", { fields: ["technology"] })[0]?.rank).toBe(2);
  });
});
