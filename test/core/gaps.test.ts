import { describe, expect, it } from "vitest";
import { formatGaps, listGaps, type Gap } from "../../src/core/index.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";

/**
 * A Workspace of one Project, `shop`, owned by storefront-team, with a prod
 * Environment and a Target to deploy onto; `model` is its `model.yaml`.
 */
const shop = (model: string): Files => ({
  "workspace.yaml": "teams:\n  storefront-team:\n    name: Storefront\n  payments-team:\n    name: Payments\nenvironments:\n  prod:\n    name: Production\n",
  "shop/project.yaml": "id: shop\nname: Shop\nowner: storefront-team\n",
  "shop/targets.yaml": "targets:\n  k8s:\n    name: Kubernetes\n    kind: cluster\n    description: The cluster\n",
  "shop/model.yaml": model,
});

async function gapsOf(files: Files, filter?: Parameters<typeof listGaps>[1]) {
  const { bundle, issues } = await loadWorkspace(files);
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  return listGaps(bundle, filter);
}

/** The gaps of one item, by its kind and id. */
const missingOf = (gaps: Gap[], kind: Gap["item"]["kind"], id: string) => gaps.find((g) => g.item.kind === kind && g.item.id === id)?.missing ?? [];

/** A Service with every field filled, deployed with a URL and an OpenAPI endpoint. */
const complete = (id: string, extra = "") =>
  `  ${id}:\n    name: ${id}\n    description: Does things\n    technology: Node.js 22\n    repository: https://github.com/acme/${id}\n${extra}`;
const deployed = (id: string) =>
  `  - service: ${id}\n    environment: prod\n    target: k8s\n    url: https://${id}.example.com\n    endpoints:\n      - { name: openapi, url: https://${id}.example.com/openapi.json }\n`;

describe("listGaps: what counts as a gap", () => {
  it("a complete Service has no gaps", async () => {
    expect(await gapsOf(shop(`services:\n${complete("web")}deployments:\n${deployed("web")}`))).toEqual([]);
  });

  it("every Element: an empty description", async () => {
    const gaps = await gapsOf(
      shop(`people:\n  shopper:\n    name: Shopper\nsystems:\n  checkout:\n    name: Checkout\n    external: true\n`),
    );
    expect(missingOf(gaps, "element", "shop:shopper")).toEqual(["description"]);
    expect(missingOf(gaps, "element", "shop:checkout")).toEqual(["description"]);
  });

  it("Service and Component: an empty technology, but not for a Person or System", async () => {
    const gaps = await gapsOf(
      shop(
        "systems:\n  checkout:\n    name: Checkout\n    description: Checks out\n    services:\n      cart:\n        name: Cart\n        description: d\n        repository: https://github.com/acme/cart\n        components:\n          ui:\n            name: UI\n            description: The UI\n" +
          "deployments:\n  - { service: cart, environment: prod, target: k8s, url: https://cart }\n",
      ),
    );
    expect(missingOf(gaps, "element", "shop:cart")).toEqual(["technology"]);
    expect(missingOf(gaps, "element", "shop:ui")).toEqual(["technology"]);
    expect(missingOf(gaps, "element", "shop:checkout")).toEqual([]);
  });

  it("Service you run: an empty repository; an External Service, a datastore or a broker has no repository gap", async () => {
    const bare = (id: string, extra = "") => `  ${id}:\n    name: ${id}\n    description: d\n    technology: t\n${extra}`;
    const gaps = await gapsOf(
      shop(
        `services:\n${bare("web")}${bare("stripe", "    external: true\n")}${bare("db", "    type: datastore\n")}${bare("bus", "    type: broker\n")}deployments:\n${deployed("web")}  - { service: db, environment: prod, target: k8s, url: https://db }\n  - { service: bus, environment: prod, target: k8s, url: https://bus }\n`,
      ),
    );
    expect(missingOf(gaps, "element", "shop:web")).toEqual(["repository"]);
    expect(missingOf(gaps, "element", "shop:stripe")).toEqual([]);
    expect(missingOf(gaps, "element", "shop:db")).toEqual([]);
    expect(missingOf(gaps, "element", "shop:bus")).toEqual([]);
  });

  it("Service you run: no Deployments; also a datastore, but not an External Service", async () => {
    const gaps = await gapsOf(
      shop(`services:\n${complete("web")}  db:\n    name: DB\n    description: d\n    technology: PostgreSQL 16\n    type: datastore\n  stripe:\n    name: Stripe\n    description: d\n    technology: t\n    external: true\n`),
    );
    expect(missingOf(gaps, "element", "shop:web")).toEqual(["deployments"]);
    expect(missingOf(gaps, "element", "shop:db")).toEqual(["deployments"]);
    expect(missingOf(gaps, "element", "shop:stripe")).toEqual([]);
  });

  it("Service you run that another Element calls: no API docs in a link label or an endpoint name", async () => {
    const caller = `  admin:\n    name: Admin\n    description: d\n    technology: t\n    repository: https://github.com/acme/admin\n    relationships:\n      - { to: api, description: Calls, technology: HTTPS }\n`;
    const api = (extra: string) => `  api:\n    name: API\n    description: d\n    technology: t\n    repository: https://github.com/acme/api\n${extra}`;
    const plain = (id: string) => `  - { service: ${id}, environment: prod, target: k8s, url: https://${id} }\n`;
    const model = (apiExtra: string, deployment = plain("api")) => shop(`services:\n${caller}${api(apiExtra)}deployments:\n${plain("admin")}${deployment}`);

    expect(missingOf(await gapsOf(model("")), "element", "shop:api")).toEqual(["api-docs"]);
    expect(missingOf(await gapsOf(model("    links:\n      - { label: Swagger UI, url: https://x }\n")), "element", "shop:api")).toEqual([]);
    expect(missingOf(await gapsOf(model("    links:\n      - { label: Runbook, url: https://x }\n")), "element", "shop:api")).toEqual(["api-docs"]);
    expect(missingOf(await gapsOf(model("", deployed("api"))), "element", "shop:api")).toEqual([]);
    // Matching ignores case: "API reference" counts.
    expect(missingOf(await gapsOf(model("    links:\n      - { label: API reference, url: https://x }\n")), "element", "shop:api")).toEqual([]);
    // Nobody calls admin, so it has no api-docs gap.
    expect(missingOf(await gapsOf(model("")), "element", "shop:admin")).toEqual([]);
  });

  it("a Service called only by a Person has no api-docs gap", async () => {
    const gaps = await gapsOf(
      shop(
        `people:\n  shopper:\n    name: Shopper\n    description: Buys\n    relationships:\n      - { to: web, description: Browses, technology: HTTPS }\nservices:\n${complete("web")}deployments:\n  - { service: web, environment: prod, target: k8s, url: https://web }\n`,
      ),
    );
    expect(gaps).toEqual([]);
  });

  it("Relationship: an empty description or technology", async () => {
    const gaps = await gapsOf(
      shop(`services:\n${complete("web", "    relationships:\n      - to: cart\n")}${complete("cart")}deployments:\n${deployed("web")}${deployed("cart")}`),
    );
    expect(missingOf(gaps, "relationship", "shop:web -> shop:cart")).toEqual(["description", "technology"]);
  });

  it("async Relationship: an empty channel; a sync Relationship has no channel gap", async () => {
    const bus = "  bus:\n    name: Bus\n    description: d\n    technology: Kafka\n    type: broker\n";
    const gaps = await gapsOf(
      shop(
        `services:\n${complete("web", "    relationships:\n      - { to: cart, description: d, technology: HTTPS }\n      - { to: orders, description: d, technology: Kafka, interaction: async, via: bus }\n")}${complete("cart")}${complete("orders")}${bus}deployments:\n${deployed("web")}${deployed("cart")}${deployed("orders")}  - { service: bus, environment: prod, target: k8s, url: https://bus }\n`,
      ),
    );
    expect(missingOf(gaps, "relationship", "shop:web -> shop:orders")).toEqual(["channel"]);
    expect(missingOf(gaps, "relationship", "shop:web -> shop:cart")).toEqual([]);
  });

  it("Deployment of a Service you run: an empty url; not for a datastore", async () => {
    const gaps = await gapsOf(
      shop(
        `services:\n${complete("web")}  db:\n    name: DB\n    description: d\n    technology: t\n    type: datastore\ndeployments:\n  - service: web\n    environment: prod\n    target: k8s\n    endpoints:\n      - { name: openapi, url: https://x }\n  - { service: db, environment: prod, target: k8s }\n`,
      ),
    );
    expect(gaps).toEqual([{ project: "shop", owner: "storefront-team", item: { kind: "deployment", id: "shop:web in prod on shop:k8s" }, missing: ["url"] }]);
  });
});

describe("listGaps: shape, order and filters", () => {
  it("groups by Project then Owner, items in Bundle order: Elements, Relationships, Deployments", async () => {
    const gaps = await gapsOf(landscapeWorkspace);
    const keys = gaps.map((g) => [g.project, g.owner]);
    expect(keys).toEqual([...keys].sort((a, b) => (a[0]! < b[0]! ? -1 : a[0]! > b[0]! ? 1 : a[1]! < b[1]! ? -1 : a[1]! > b[1]! ? 1 : 0)));
    expect(gaps.find((g) => g.item.id === "shop:fraud-check")).toEqual({
      project: "shop",
      owner: "payments-team",
      item: { kind: "element", id: "shop:fraud-check" },
      missing: ["description", "technology", "repository", "deployments"],
    });
  });

  it("narrows to a Project and to an Owner Team", async () => {
    const all = await gapsOf(landscapeWorkspace);
    const payments = await gapsOf(landscapeWorkspace, { project: "payments" });
    expect(payments.length).toBeGreaterThan(0);
    expect(payments).toEqual(all.filter((g) => g.project === "payments"));
    const team = await gapsOf(landscapeWorkspace, { owner: "payments-team" });
    expect(team).toEqual(all.filter((g) => g.owner === "payments-team"));
    expect(team.map((g) => g.project)).toContain("shop");
    expect(await gapsOf(landscapeWorkspace, { project: "shop", owner: "payments-team" })).toEqual(all.filter((g) => g.project === "shop" && g.owner === "payments-team"));
  });
});

describe("formatGaps", () => {
  it("prints a heading per Project and Owner Team and a line per item", () => {
    const gaps: Gap[] = [
      { project: "shop", owner: "a-team", item: { kind: "element", id: "shop:web" }, missing: ["description", "technology"] },
      { project: "shop", owner: "a-team", item: { kind: "relationship", id: "shop:web -> shop:cart" }, missing: ["channel"] },
      { project: "shop", owner: "b-team", item: { kind: "deployment", id: "shop:web in prod on shop:k8s" }, missing: ["url"] },
    ];
    expect(formatGaps(gaps, { elements: [{ id: "shop:web", kind: "service" }] } as unknown as Bundle)).toBe(
      "## shop\n### a-team\n- service shop:web: description, technology\n- relationship shop:web -> shop:cart: channel\n### b-team\n- deployment shop:web in prod on shop:k8s: url\n",
    );
  });

  it("prints nothing for no gaps", () => {
    expect(formatGaps([], { elements: [] } as unknown as Bundle)).toBe("");
  });
});
