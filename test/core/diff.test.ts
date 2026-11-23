import { describe, expect, it } from "vitest";
import { diff } from "../../src/core/index.ts";
import { landscapeWorkspace, relationshipWorkspace } from "../support/fixtures.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";

/** Loads two fixture Workspaces and diffs their Bundles. */
async function changesBetween(before: Files, after: Files) {
  const [a, b] = await Promise.all([loadWorkspace(before), loadWorkspace(after)]);
  return diff(a.bundle, b.bundle);
}

/** Changes as `[type, kind, id, fields]`, for compact assertions. */
const brief = (changes: Awaited<ReturnType<typeof changesBetween>>) => changes.map((c) => [c.type, c.kind, c.id, c.fields]);

describe("diff between two Bundles", () => {
  it("finds no Changes between identical Workspaces, whatever their source lines and key order", async () => {
    const reordered: Files = {
      ...landscapeWorkspace,
      "platform/targets.yaml": `# Moved down a line.
targets:
  aws-eu:
    kind: region
    name: AWS eu-west-1
    targets:
      eks-prod:
        kind: cluster
        name: EKS prod
`,
    };
    expect(await changesBetween(landscapeWorkspace, reordered)).toEqual([]);
  });

  it("lists added, removed and changed Elements with both sides and the changed fields", async () => {
    const after: Files = {
      ...landscapeWorkspace,
      "shop/web.yaml": `services:
  web:
    name: Web shop
    technology: Next.js
  wishlist:
    name: Wishlist
`,
    };
    const changes = await changesBetween(landscapeWorkspace, after);

    expect(brief(changes.filter((c) => c.kind === "element"))).toEqual([
      ["removed", "element", "shop:events", []],
      ["changed", "element", "shop:web", ["name", "technology"]],
      ["added", "element", "shop:wishlist", []],
    ]);
    const web = changes.find((c) => c.id === "shop:web")!;
    expect([web.before?.name, web.after?.name]).toEqual(["Web", "Web shop"]);
    expect(changes.find((c) => c.id === "shop:wishlist")).toMatchObject({ before: null, after: { id: "shop:wishlist", name: "Wishlist" } });
    expect(JSON.stringify(changes)).not.toContain('"source"');
  });

  it("compares Owner as the effective Owner, so a Project's new default Owner changes its Elements", async () => {
    const after: Files = { ...landscapeWorkspace, "payments/project.yaml": "id: payments\nname: Payments\nowner: platform-team\n" };
    const changes = await changesBetween(landscapeWorkspace, after);

    expect(brief(changes)).toEqual([
      ["changed", "project", "payments", ["owner"]],
      ["changed", "element", "payments:charges", ["owner"]],
      ["changed", "element", "payments:payments", ["owner"]],
      ["changed", "element", "payments:payments-api", ["owner"]],
      ["changed", "deployment", "payments:payments-api in prod on platform:eks-prod", ["owner"]],
    ]);
    expect(changes[1]).toMatchObject({ before: { owner: "payments-team" }, after: { owner: "platform-team" } });
  });

  it("matches Relationships by id, then by a unique pair, then by pair, technology and interaction", async () => {
    const before: Files = {
      ...relationshipWorkspace,
      "shop/extra.yaml": `services:
  search:
    name: Search
    relationships:
      - { to: cart, technology: gRPC, description: Reads carts }
      - { to: cart, technology: HTTPS, description: Lists carts }
      - { to: cart, technology: HTTPS, description: Old one }
      - { to: cart, technology: HTTPS, description: Old two }
`,
    };
    const after: Files = {
      ...relationshipWorkspace,
      // `authorise` matched by id; the cart → cart-db pair is unique on both sides.
      "shop/systems.yaml": relationshipWorkspace["shop/systems.yaml"]!.replace("Authorises a card", "Authorises a card payment").replace("Reads and writes carts", "Stores carts"),
      "shop/extra.yaml": `services:
  search:
    name: Search
    relationships:
      - { to: cart, technology: gRPC, description: Reads carts fast }
      - { to: cart, technology: HTTPS, description: New one }
      - { to: cart, technology: HTTPS, description: New two }
`,
    };
    const changes = (await changesBetween(before, after)).filter((c) => c.kind === "relationship");

    expect(brief(changes)).toEqual([
      ["changed", "relationship", "shop:authorise", ["description"]],
      ["changed", "relationship", "shop:cart -> shop:cart-db", ["description"]],
      ["changed", "relationship", "shop:search -> shop:cart", ["description"]],
      // Three HTTPS edges on the same pair before and two after: none can be matched.
      ["removed", "relationship", "shop:search -> shop:cart", []],
      ["removed", "relationship", "shop:search -> shop:cart", []],
      ["removed", "relationship", "shop:search -> shop:cart", []],
      ["added", "relationship", "shop:search -> shop:cart", []],
      ["added", "relationship", "shop:search -> shop:cart", []],
    ]);
    expect(changes[2]).toMatchObject({ before: { technology: "gRPC", description: "Reads carts" }, after: { description: "Reads carts fast" } });
  });

  it("never reports an unchanged Relationship that shares its pair with a changed one", async () => {
    const edges = (description: string) => ({
      ...relationshipWorkspace,
      "shop/search.yaml": `services:\n  search:\n    name: Search\n    relationships:\n      - { to: cart, description: ${description} }\n      - { to: cart, description: Lists }\n`,
    });
    const changes = (await changesBetween(edges("Reads"), edges("Reads carts"))).filter((c) => c.kind === "relationship");

    // Two Relationships on the pair at each side, both without technology: "Reads" can't be matched, but "Lists" is not reported.
    expect(brief(changes)).toEqual([
      ["removed", "relationship", "shop:search -> shop:cart", []],
      ["added", "relationship", "shop:search -> shop:cart", []],
    ]);
    expect([changes[0]!.before?.description, changes[1]!.after?.description]).toEqual(["Reads", "Reads carts"]);
  });

  it("matches Deployments by their triple and diffs their URLs and endpoints", async () => {
    const after: Files = {
      ...landscapeWorkspace,
      "payments/deployments.yaml": `deployments:
  - service: payments-api
    environment: prod
    target: platform:eks-prod
    url: https://pay.example.com
    endpoints:
      - { name: health, url: https://pay.example.com/healthz }
`,
      "shop/fraud.yaml": landscapeWorkspace["shop/fraud.yaml"]!.replace("deployments:\n  - { service: cart, environment: prod, target: platform:eks-prod }\n", ""),
    };
    const changes = await changesBetween(landscapeWorkspace, after);

    expect(brief(changes)).toEqual([
      ["changed", "deployment", "payments:payments-api in prod on platform:eks-prod", ["url", "endpoints"]],
      ["removed", "deployment", "shop:cart in prod on platform:eks-prod", []],
    ]);
  });
});
