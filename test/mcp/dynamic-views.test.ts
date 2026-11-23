import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { connect } from "../support/mcp.ts";
import type { Files } from "../support/workspace.ts";

/** web calls api; orders publishes `order-placed` on the bus broker, which mailer subscribes to; a Dynamic View walks through it. */
const workspace: Files = {
  "workspace.yaml": "teams:\n  core:\n    name: Core\n",
  "shop/project.yaml": "id: shop\nname: Shop\nowner: core\n",
  "shop/model.yaml": `services:
  web:
    name: Web
    relationships:
      - to: api
        description: Places an order
  api:
    name: API
    relationships:
      - to: orders
        description: Records the order
  orders:
    name: Orders
  bus:
    name: Bus
    type: broker
  mailer:
    name: Mailer
    relationships:
      - id: order-mail
        to: orders
        interaction: async
        via: bus
        channel: order-placed
        description: Emails a confirmation
`,
  "shop/views.yaml": `# Scenarios.
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: web, to: api }
        - { from: api, to: orders, note: In one transaction }
        - { from: api, to: web, return: true }
        - { from: orders, to: mailer }
`,
};

async function setup(files: Files = workspace) {
  const session = await connect(files);
  const read = (path: string) => readFile(join(session.root, path), "utf8");
  return { ...session, read };
}

const purchase = { id: "shop:purchase", kind: "dynamic", title: "Purchase" };

describe("get_view for a Dynamic View", () => {
  it("returns participants and Steps, an event drawn publisher → subscriber with its broker and channel", async () => {
    const { call } = await setup();
    const result = await call("get_view", { id: "shop:purchase" });

    expect(result.isError).toBeFalsy();
    const view = result.structuredContent as { participants: string[]; steps: Record<string, unknown>[] };
    expect(view).toMatchObject({ ...purchase, participants: ["shop:web", "shop:api", "shop:orders", "shop:mailer"] });
    expect(view.steps.map(({ relationship, ...s }) => ({ ...s, relationship: (relationship as { from: string; to: string }).from + " → " + (relationship as { to: string }).to }))).toEqual([
      { n: 1, kind: "call", from: "shop:web", to: "shop:api", relationship: "shop:web → shop:api", interaction: "sync", description: "Places an order" },
      { n: 2, kind: "call", from: "shop:api", to: "shop:orders", relationship: "shop:api → shop:orders", interaction: "sync", description: "Records the order", note: "In one transaction" },
      { n: 3, kind: "return", from: "shop:api", to: "shop:web", relationship: "shop:web → shop:api", interaction: "sync", description: "Places an order" },
      { n: 4, kind: "event", from: "shop:orders", to: "shop:mailer", relationship: "shop:mailer → shop:orders", interaction: "async", via: "shop:bus", channel: "order-placed", description: "order-placed" },
    ]);
  });

  it("tells the Steps in text, one line each", async () => {
    const { call, text } = await setup();
    const out = text(await call("get_view", { id: "shop:purchase" }));
    expect(out).toContain("Purchase (shop:purchase): 4 participants, 4 Steps.");
    expect(out).toContain("3. shop:api ⇠ shop:web (return): Places an order");
    expect(out).toContain("4. shop:orders → shop:mailer (event via shop:bus · order-placed): order-placed");
  });
});

describe("list_views and get_element for a Dynamic View", () => {
  it("lists a Dynamic View under `dynamic`, and for a broker that only routes its events", async () => {
    const { call } = await setup();
    expect((await call("list_views", { kind: "dynamic" })).structuredContent).toEqual({ total: 1, truncated: false, views: [purchase] });
    expect((await call("list_views", { element: "shop:bus" })).structuredContent).toMatchObject({ views: expect.arrayContaining([purchase]) });
    expect((await call("list_views", { element: "shop:bus", kind: "dynamic" })).structuredContent).toEqual({ total: 1, truncated: false, views: [purchase] });
  });

  it("gives each Element the Dynamic Views it takes part in", async () => {
    const { call } = await setup();
    expect((await call("get_element", { id: "shop:bus" })).structuredContent).toMatchObject({ dynamicViews: [{ id: "shop:purchase", title: "Purchase" }] });
    expect((await call("get_element", { id: "shop:mailer" })).structuredContent).toMatchObject({ dynamicViews: [{ id: "shop:purchase", title: "Purchase" }] });
  });
});

describe("upsert_view for a Dynamic View", () => {
  it("adds a Dynamic View under `views: dynamic:`, and get_view resolves it", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_view", {
      project: "shop",
      id: "mail",
      definition: { title: "Mail", steps: [{ from: "orders", to: "mailer", description: "Order confirmed" }] },
      file: "views.yaml",
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ action: "created", id: "shop:mail", files: ["archidocs/shop/views.yaml"] });
    expect(await read("shop/views.yaml")).toContain(`    mail:
      title: Mail
      steps:
        - from: orders
          to: mailer
          description: Order confirmed
`);
    const view = await call("get_view", { id: "shop:mail" });
    expect(view.structuredContent).toMatchObject({ steps: [{ n: 1, kind: "event", description: "Order confirmed" }] });
  });

  it("refuses a Dynamic View whose Step has no Relationship, with the issue", async () => {
    const { call } = await setup();
    const result = await call("upsert_view", { project: "shop", id: "mail", definition: { title: "Mail", steps: [{ from: "mailer", to: "web" }] } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", issues: [{ rule: "missing-step" }] });
  });

  it("updates a Dynamic View in place, keeping comments", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_view", {
      project: "shop",
      id: "purchase",
      definition: { title: "Checkout", steps: [{ from: "web", to: "api" }, { from: "api", to: "orders", note: "In one transaction" }, { from: "api", to: "web", return: true }, { from: "orders", to: "mailer" }] },
    });
    expect(result.structuredContent).toMatchObject({ action: "updated", id: "shop:purchase" });
    expect(await read("shop/views.yaml")).toBe(workspace["shop/views.yaml"]!.replace("title: Purchase", "title: Checkout"));
  });
});
