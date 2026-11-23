import { describe, expect, it } from "vitest";
import { loadWorkspace, type Files } from "../support/workspace.ts";
import { deploymentWorkspace } from "../support/fixtures.ts";

describe("Deployment Targets", () => {
  it("nest region › cluster, with qualified ids, their own Owner, kind and tags", async () => {
    const { bundle, issues } = await loadWorkspace(deploymentWorkspace);

    expect(issues).toEqual([]);
    expect(bundle.targets).toEqual([
      {
        id: "platform:aws-eu",
        parent: null,
        name: "AWS eu-west-1",
        kind: "region",
        description: null,
        owner: "platform-team",
        tags: ["aws"],
        links: [],
        source: { file: "archidocs/platform/targets.yaml", line: 2 },
      },
      expect.objectContaining({ id: "platform:eks-prod", parent: "platform:aws-eu", kind: "cluster", owner: "storefront-team", tags: [] }),
      expect.objectContaining({ id: "platform:eks-staging", parent: "platform:aws-eu", kind: "cluster", owner: "platform-team" }),
      expect.objectContaining({ id: "shop:shop-edge", parent: null, kind: "cdn", owner: "storefront-team" }),
    ]);
  });
});

describe("Deployments", () => {
  it("place Services on Targets shared across Projects, in two Environments, with URLs and the Service's Owner", async () => {
    const { bundle, issues } = await loadWorkspace(deploymentWorkspace);

    expect(issues).toEqual([]);
    expect(bundle.deployments.map((d) => [d.service, d.environment, d.target, d.url, d.owner])).toEqual([
      ["payments:payments-api", "prod", "platform:eks-prod", null, "storefront-team"],
      ["shop:web", "prod", "platform:eks-prod", "https://shop.example.com", "storefront-team"],
      ["shop:web", "prod", "shop:shop-edge", null, "storefront-team"],
      ["shop:web", "staging", "platform:eks-staging", "https://staging.shop.example.com", "storefront-team"],
    ]);
    expect(bundle.deployments[1]).toEqual({
      service: "shop:web",
      environment: "prod",
      target: "platform:eks-prod",
      url: "https://shop.example.com",
      endpoints: [{ name: "health", url: "https://shop.example.com/healthz" }],
      owner: "storefront-team",
      source: { file: "archidocs/shop/model.yaml", line: 10 },
    });
  });
});

const issuesOf = async (files: Files) =>
  (await loadWorkspace({ ...deploymentWorkspace, ...files })).issues.map((i) => [i.file, i.line, i.rule, i.message]);

describe("duplicate-deployment", () => {
  it("is reported at the later location, matching bare and qualified ids, across files", async () => {
    expect(
      await issuesOf({
        "shop/zz-more.yaml": "deployments:\n  - { service: shop:web, environment: staging, target: platform:eks-staging, url: https://other.example.com }\n",
      }),
    ).toEqual([
      [
        "archidocs/shop/zz-more.yaml",
        2,
        "duplicate-deployment",
        'Service "shop:web" is already deployed to "platform:eks-staging" in Environment "staging" at archidocs/shop/model.yaml:9',
      ],
    ]);
  });
});

describe("a Deployment's references", () => {
  it("report an unknown Environment with the nearest id", async () => {
    expect(await issuesOf({ "shop/zz-more.yaml": "deployments:\n  - { service: web, environment: production, target: shop-edge }\n" })).toEqual([
      ["archidocs/shop/zz-more.yaml", 2, "unknown-environment", 'Unknown Environment "production"; did you mean "prod"?'],
    ]);
  });

  it("report an unknown Target, bare or in another Project, with the nearest id", async () => {
    expect(
      await issuesOf({
        "shop/zz-more.yaml": "deployments:\n  - { service: web, environment: prod, target: shop-egde }\n  - { service: web, environment: staging, target: platform:eks-stagin }\n",
      }),
    ).toEqual([
      ["archidocs/shop/zz-more.yaml", 2, "unknown-target", 'Unknown Deployment Target "shop-egde" in Project "shop"; did you mean "shop-edge"?'],
      ["archidocs/shop/zz-more.yaml", 3, "unknown-target", 'Unknown Deployment Target "eks-stagin" in Project "platform"; did you mean "eks-staging"?'],
    ]);
  });

  it("report a `service` naming no Element as unknown-element", async () => {
    expect(await issuesOf({ "shop/zz-more.yaml": "deployments:\n  - { service: payments:payment-api, environment: prod, target: shop-edge }\n" })).toEqual([
      ["archidocs/shop/zz-more.yaml", 2, "unknown-element", 'Unknown Element "payment-api" in Project "payments"; did you mean "payments-api"?'],
    ]);
  });

  it("report a `service` naming a Target or a non-Service Element as wrong-kind", async () => {
    expect(
      await issuesOf({
        "shop/zz-more.yaml":
          "people:\n  shopper:\n    name: Shopper\ndeployments:\n  - { service: shopper, environment: prod, target: shop-edge }\n  - { service: shop-edge, environment: prod, target: shop-edge }\n",
      }),
    ).toEqual([
      ["archidocs/shop/zz-more.yaml", 5, "wrong-kind", 'A Deployment\'s `service` must name a Service, but "shop:shopper" is a Person'],
      ["archidocs/shop/zz-more.yaml", 6, "wrong-kind", 'A Deployment\'s `service` must name a Service, but "shop:shop-edge" is a Deployment Target'],
    ]);
  });
});

describe("Deployment Target declarations", () => {
  it("share the Element id namespace within a Project", async () => {
    expect(await issuesOf({ "shop/zz-more.yaml": "targets:\n  web:\n    name: Web host\n    kind: vm\n" })).toEqual([
      ["archidocs/shop/zz-more.yaml", 2, "duplicate-id", 'Id "web" is already declared in Project "shop" at archidocs/shop/model.yaml:2'],
    ]);
  });

  it("may reuse an id declared in another Project", async () => {
    expect(await issuesOf({ "shop/zz-more.yaml": "targets:\n  aws-eu:\n    name: Shop's own region\n    kind: region\n" })).toEqual([]);
  });

  it("report an unknown owner, a missing kind and unknown fields at any depth", async () => {
    expect(
      await issuesOf({
        "shop/zz-more.yaml": "targets:\n  dc:\n    name: DC\n    kind: datacenter\n    owner: platfrom-team\n    targets:\n      rack:\n        name: Rack\n        knd: rack\n",
      }),
    ).toEqual([
      ["archidocs/shop/zz-more.yaml", 5, "unknown-team", 'Unknown Team "platfrom-team"; did you mean "platform-team"?'],
      ["archidocs/shop/zz-more.yaml", 7, "missing-field", 'Missing required field "kind"'],
      ["archidocs/shop/zz-more.yaml", 9, "unknown-field", 'Unknown field "knd"; did you mean "kind"?'],
    ]);
  });
});

describe("Deployment declarations", () => {
  it("report a malformed url, an unknown field and a missing field", async () => {
    expect(
      await issuesOf({
        "shop/zz-more.yaml": "deployments:\n  - { service: web, environment: staging, target: shop-edge, url: not-a-url }\n  - { service: web, environment: staging, targett: shop-edge }\n",
      }),
    ).toEqual([
      ["archidocs/shop/zz-more.yaml", 2, "invalid-value", 'Invalid value for "url": Invalid URL'],
      ["archidocs/shop/zz-more.yaml", 3, "missing-field", 'Missing required field "target"'],
      ["archidocs/shop/zz-more.yaml", 3, "unknown-field", 'Unknown field "targett"; did you mean "target"?'],
    ]);
  });
});
