import { describe, expect, it } from "vitest";
import { deploymentWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";

describe("get_deployments", () => {
  it("returns each Deployment's Environment, full Deployment Target chain, url and endpoints", async () => {
    const { call, text } = await connect(deploymentWorkspace);
    const result = await call("get_deployments", { service: "shop:web" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      service: { id: "shop:web", kind: "service", name: "Web" },
      environment: null,
      total: 3,
      truncated: false,
      deployments: [
        {
          environment: "prod",
          target: "platform:eks-prod",
          targetPath: [
            { id: "platform:aws-eu", name: "AWS eu-west-1", kind: "region" },
            { id: "platform:eks-prod", name: "EKS prod", kind: "cluster" },
          ],
          url: "https://shop.example.com",
          endpoints: [{ name: "health", url: "https://shop.example.com/healthz" }],
          instances: 1,
          owner: "storefront-team",
          source: { file: "archidocs/shop/model.yaml", line: 10 },
        },
        expect.objectContaining({ environment: "prod", target: "shop:shop-edge", targetPath: [{ id: "shop:shop-edge", name: "Shop edge", kind: "cdn" }], url: null }),
        expect.objectContaining({ environment: "staging", target: "platform:eks-staging", url: "https://staging.shop.example.com" }),
      ],
    });
    expect(text(result)).toBe(
      [
        "shop:web (Web) has 3 Deployments.",
        "- prod on platform:aws-eu › platform:eks-prod: https://shop.example.com; health: https://shop.example.com/healthz",
        "- prod on shop:shop-edge: no URL",
        "- staging on platform:aws-eu › platform:eks-staging: https://staging.shop.example.com",
      ].join("\n"),
    );
  });

  it("narrows to one Environment", async () => {
    const { call, text } = await connect(deploymentWorkspace);
    const result = await call("get_deployments", { service: "shop:web", environment: "staging" });
    expect(result.structuredContent).toMatchObject({ environment: "staging", total: 1, deployments: [{ url: "https://staging.shop.example.com" }] });
    expect(text(result).split("\n")[0]).toBe("shop:web (Web) has 1 Deployment in staging.");
  });

  it("says so when a Service is not deployed", async () => {
    const { call, text } = await connect({ ...deploymentWorkspace, "shop/more.yaml": "services:\n  cart:\n    name: Cart\n" });
    const result = await call("get_deployments", { service: "shop:cart" });
    expect(result.structuredContent).toMatchObject({ total: 0, deployments: [] });
    expect(text(result)).toBe("shop:cart (Cart) has no Deployments.");

    const none = await call("get_deployments", { service: "payments:payments-api", environment: "staging" });
    expect(text(none)).toBe("payments:payments-api (Payments API) has no Deployments in staging.");
  });

  it("truncates to limit and reports the total", async () => {
    const { call } = await connect(deploymentWorkspace);
    const result = await call("get_deployments", { service: "shop:web", limit: 1 });
    expect(result.structuredContent).toMatchObject({ total: 3, truncated: true });
    expect(result.structuredContent!.deployments).toHaveLength(1);
  });

  it("gives not_found with suggestions for an unknown Service or Environment", async () => {
    const { call } = await connect(deploymentWorkspace);
    expect((await call("get_deployments", { service: "web" })).structuredContent).toEqual({
      code: "not_found",
      message: 'No Service "web".',
      suggestions: ["shop:web"],
    });
    const env = await call("get_deployments", { service: "shop:web", environment: "production" });
    expect(env.isError).toBe(true);
    expect(env.structuredContent).toEqual({ code: "not_found", message: 'No Environment "production".', suggestions: ["prod"] });
  });

  it("gives invalid_input for an Element that is not a Service", async () => {
    const { call } = await connect({ ...deploymentWorkspace, "shop/people.yaml": "people:\n  shopper:\n    name: Shopper\n" });
    const result = await call("get_deployments", { service: "shop:shopper" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ code: "invalid_input", message: '"shop:shopper" is a Person, not a Service; only Services have Deployments.' });
  });
});

describe("search_elements by URL", () => {
  it("finds the Service from a URL or a host, with the Deployment that matched", async () => {
    const { call, text } = await connect(deploymentWorkspace);
    const result = await call("search_elements", { query: "https://staging.shop.example.com/cart" });
    expect(result.structuredContent).toEqual({
      query: "https://staging.shop.example.com/cart",
      total: 1,
      truncated: false,
      elements: [
        {
          id: "shop:web",
          kind: "service",
          name: "Web",
          owner: "storefront-team",
          parent: null,
          deployment: { environment: "staging", target: "platform:eks-staging", url: "https://staging.shop.example.com" },
        },
      ],
    });
    expect(text(result)).toBe(
      ['1 Element matches "https://staging.shop.example.com/cart".', "- shop:web (Web): Service, storefront-team; URL https://staging.shop.example.com in staging"].join("\n"),
    );

    const byHost = await call("search_elements", { query: "shop.example.com" });
    expect(byHost.structuredContent!.elements).toEqual([expect.objectContaining({ id: "shop:web", deployment: expect.objectContaining({ environment: "prod" }) })]);
  });
});

describe("get_element", () => {
  it("includes a Service's Deployments with their URLs", async () => {
    const { call, text } = await connect(deploymentWorkspace);
    const result = await call("get_element", { id: "shop:web" });
    expect(result.structuredContent!.deployments).toEqual([
      expect.objectContaining({ environment: "prod", target: "platform:eks-prod", url: "https://shop.example.com", endpoints: [{ name: "health", url: "https://shop.example.com/healthz" }] }),
      expect.objectContaining({ environment: "prod", target: "shop:shop-edge", url: null }),
      expect.objectContaining({ environment: "staging", target: "platform:eks-staging", url: "https://staging.shop.example.com" }),
    ]);
    expect(text(result)).toContain(
      "- deployments: prod on platform:eks-prod (https://shop.example.com), prod on shop:shop-edge, staging on platform:eks-staging (https://staging.shop.example.com)",
    );
  });
});
