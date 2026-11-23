import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Files } from "../support/workspace.ts";
import { connect } from "../support/mcp.ts";

/** A commented Workspace with nested Targets and Deployments across Projects. */
const deployed: Files = {
  "workspace.yaml": `teams:
  shop-team:
    name: Shop
  platform-team:
    name: Platform
environments:
  prod:
    name: Production
  staging:
    name: Staging
`,
  "platform/project.yaml": `id: platform
name: Platform
owner: platform-team
`,
  "platform/targets.yaml": `# Where everything runs.
targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      # The production cluster.
      eks-prod:
        name: EKS prod # shown on Deployment Views
        kind: cluster
  on-prem:
    name: On-prem
    kind: datacentre
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: shop-team
`,
  "shop/services.yaml": `services:
  web:
    name: Web
  cart:
    name: Cart
`,
  "shop/deploy.yaml": `# Each row is one Service in one Environment on one Target.
deployments:
  - service: web
    environment: prod
    target: platform:eks-prod
    url: https://shop.example.com # public
  - { service: cart, environment: prod, target: platform:eks-prod }
`,
};

async function setup(files: Files = deployed) {
  const session = await connect(files);
  const read = (path: string) => readFile(join(session.root, path), "utf8");
  return { ...session, read };
}

describe("upsert_target", () => {
  it("updates an existing nested Target in place, keeping comments", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_target", { project: "platform", id: "eks-prod", fields: { description: "Runs prod workloads.", owner: "shop-team" } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ action: "updated", id: "platform:eks-prod", files: ["archidocs/platform/targets.yaml"], dryRun: false });
    expect(await read("platform/targets.yaml")).toBe(`# Where everything runs.
targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      # The production cluster.
      eks-prod:
        name: EKS prod # shown on Deployment Views
        kind: cluster
        description: Runs prod workloads.
        owner: shop-team
  on-prem:
    name: On-prem
    kind: datacentre
`);
  });

  it("puts a new Target under its parent, and a new top-level one into the named file, else model.yaml", async () => {
    const { call, read } = await setup();
    const nested = await call("upsert_target", { project: "platform", id: "eks-staging", parent: "aws-eu", fields: { name: "EKS staging", kind: "cluster" } });
    expect(nested.structuredContent).toMatchObject({ action: "created", id: "platform:eks-staging", files: ["archidocs/platform/targets.yaml"] });
    expect(await read("platform/targets.yaml")).toBe(`# Where everything runs.
targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      # The production cluster.
      eks-prod:
        name: EKS prod # shown on Deployment Views
        kind: cluster
      eks-staging:
        name: EKS staging
        kind: cluster
  on-prem:
    name: On-prem
    kind: datacentre
`);

    await call("upsert_target", { project: "platform", id: "gcp", fields: { name: "GCP", kind: "cloud" } });
    expect(await read("platform/model.yaml")).toBe(`targets:
  gcp:
    name: GCP
    kind: cloud
`);
    await call("upsert_target", { project: "platform", id: "azure", file: "clouds.yaml", fields: { name: "Azure", kind: "cloud" } });
    expect(await read("platform/clouds.yaml")).toBe(`targets:
  azure:
    name: Azure
    kind: cloud
`);
  });

  it("refuses a new Target with no kind, or an id an Element already uses, writing nothing", async () => {
    const { call, read } = await setup();
    const before = await read("platform/targets.yaml");
    const noKind = await call("upsert_target", { project: "platform", id: "eks-dev", parent: "aws-eu", fields: { name: "EKS dev" } });
    expect(noKind.isError).toBe(true);
    expect(noKind.structuredContent).toMatchObject({ code: "validation_failed", issues: [expect.objectContaining({ file: "archidocs/platform/targets.yaml", severity: "error" })] });
    expect(await read("platform/targets.yaml")).toBe(before);

    const clash = await call("upsert_target", { project: "shop", id: "web", fields: { name: "Web", kind: "host" } });
    expect(clash.structuredContent).toMatchObject({ code: "validation_failed", issues: [expect.objectContaining({ rule: "duplicate-id" })] });
  });

  it("reports an unknown parent as not_found with a suggestion", async () => {
    const { call } = await setup();
    const result = await call("upsert_target", { project: "platform", id: "x", parent: "aws-e", fields: { name: "X", kind: "zone" } });
    expect(result.structuredContent).toMatchObject({ code: "not_found", suggestions: ["platform:aws-eu"] });
  });
});

describe("remove_target", () => {
  it("is refused while a Deployment uses the Target or a Target is in it, listing each reference", async () => {
    const { call, read } = await setup();
    const used = await call("remove_target", { project: "platform", id: "eks-prod" });
    expect(used.isError).toBe(true);
    expect(used.structuredContent).toMatchObject({
      code: "validation_failed",
      references: [
        { file: "archidocs/shop/deploy.yaml", line: 3, what: "Deployment of shop:web to prod on platform:eks-prod" },
        { file: "archidocs/shop/deploy.yaml", line: 7, what: "Deployment of shop:cart to prod on platform:eks-prod" },
      ],
    });
    const parent = await call("remove_target", { project: "platform", id: "aws-eu" });
    expect(parent.structuredContent).toMatchObject({ code: "validation_failed", references: [{ file: "archidocs/platform/targets.yaml", line: 8, what: "Target platform:eks-prod is in it" }] });
    expect(await read("platform/targets.yaml")).toContain("aws-eu:");
  });

  it("removes an unused Target, keeping the rest of the file, and only shows the diff on dry_run", async () => {
    const { call, read } = await setup();
    const before = await read("platform/targets.yaml");
    const dry = await call("remove_target", { project: "platform", id: "on-prem", dry_run: true });
    expect(dry.structuredContent).toMatchObject({ action: "removed", id: "platform:on-prem", dryRun: true });
    expect(dry.structuredContent!.diff).toContain("-  on-prem:\n");
    expect(await read("platform/targets.yaml")).toBe(before);

    await call("remove_target", { project: "platform", id: "on-prem" });
    expect(await read("platform/targets.yaml")).toBe(`# Where everything runs.
targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      # The production cluster.
      eks-prod:
        name: EKS prod # shown on Deployment Views
        kind: cluster
`);
  });
});

describe("upsert_deployment", () => {
  it("updates the Deployment its triple names, keeping flow style and comments", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_deployment", { project: "shop", service: "shop:cart", environment: "prod", target: "platform:eks-prod", fields: { url: "https://cart.example.com" } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ action: "updated", id: null, service: "shop:cart", environment: "prod", target: "platform:eks-prod", files: ["archidocs/shop/deploy.yaml"] });
    expect(await read("shop/deploy.yaml")).toBe(`# Each row is one Service in one Environment on one Target.
deployments:
  - service: web
    environment: prod
    target: platform:eks-prod
    url: https://shop.example.com # public
  - { service: cart, environment: prod, target: platform:eks-prod, url: https://cart.example.com }
`);
  });

  it("appends a new Deployment beside the Project's others, else to the named file", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_deployment", {
      project: "shop",
      service: "web",
      environment: "staging",
      target: "platform:eks-prod",
      fields: { endpoints: [{ name: "health", url: "https://staging.shop.example.com/health" }] },
    });
    expect(result.structuredContent).toMatchObject({ action: "created", files: ["archidocs/shop/deploy.yaml"] });
    expect(await read("shop/deploy.yaml")).toBe(`# Each row is one Service in one Environment on one Target.
deployments:
  - service: web
    environment: prod
    target: platform:eks-prod
    url: https://shop.example.com # public
  - { service: cart, environment: prod, target: platform:eks-prod }
  - service: web
    environment: staging
    target: platform:eks-prod
    endpoints:
      - name: health
        url: https://staging.shop.example.com/health
`);

    await call("upsert_deployment", { project: "platform", service: "shop:cart", environment: "staging", target: "on-prem" });
    expect(await read("platform/model.yaml")).toBe(`deployments:
  - service: shop:cart
    environment: staging
    target: on-prem
`);
  });

  it("refuses a Deployment to an unknown Environment with the issue", async () => {
    const { call, read } = await setup();
    const before = await read("shop/deploy.yaml");
    const result = await call("upsert_deployment", { project: "shop", service: "web", environment: "qa", target: "platform:eks-prod" });
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", issues: [expect.objectContaining({ rule: "unknown-environment" })] });
    expect(await read("shop/deploy.yaml")).toBe(before);
  });
});

describe("remove_deployment", () => {
  it("removes the Deployment its triple names, keeping the comment above the list", async () => {
    const { call, read } = await setup();
    const result = await call("remove_deployment", { project: "shop", service: "web", environment: "prod", target: "platform:eks-prod" });
    expect(result.structuredContent).toMatchObject({ action: "removed", service: "shop:web" });
    expect(await read("shop/deploy.yaml")).toBe(`# Each row is one Service in one Environment on one Target.
deployments:
  - { service: cart, environment: prod, target: platform:eks-prod }
`);
  });

  it("reports a triple with no Deployment as not_found", async () => {
    const { call } = await setup();
    const result = await call("remove_deployment", { project: "shop", service: "web", environment: "staging", target: "platform:eks-prod" });
    expect(result.structuredContent).toMatchObject({ code: "not_found" });
  });
});
