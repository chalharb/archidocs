import { describe, expect, it } from "vitest";
import { listViews, resolveDynamicView } from "../../src/core/index.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";

/**
 * A shopper uses web, which calls api, which charges payments-api in another
 * Project. orders publishes `order-placed` on the bus broker; mailer and
 * ledger subscribe. Both shop Services sit in the checkout System.
 */
const scenario: Files = {
  "workspace.yaml": "teams:\n  core:\n    name: Core\n",
  "shop/project.yaml": "id: shop\nname: Shop\nowner: core\n",
  "shop/model.yaml": `people:
  shopper:
    name: Shopper
    relationships:
      - to: web
        description: Browses the shop
systems:
  checkout:
    name: Checkout
    services:
      web:
        name: Web
        relationships:
          - id: place-order
            to: api
            description: Places an order
      api:
        name: API
        relationships:
          - to: payments:payments-api
            description: Charges the card
          - to: orders
            description: Records the order
services:
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
  ledger:
    name: Ledger
    relationships:
      - to: orders
        interaction: async
        via: bus
        description: Books the sale
`,
  "payments/project.yaml": "id: payments\nname: Payments\nowner: core\n",
  "payments/model.yaml": "systems:\n  payments:\n    name: Payments\n    services:\n      payments-api:\n        name: Payments API\n",
};

/** The scenario plus `views: dynamic:` in the shop Project, given as YAML under it, and any other files. */
const withDynamic = (views: string, extra: Files = {}): Files => ({
  ...scenario,
  "shop/views.yaml": `views:\n  dynamic:\n${views.replace(/^/gm, "    ")}\n`,
  ...extra,
});

async function resolved(views: string, extra: Files = {}) {
  const { bundle, issues } = await loadWorkspace(withDynamic(views, extra));
  return { bundle, issues, view: resolveDynamicView(bundle, "shop:flow") };
}

/** Steps as `[n, kind, from, to, description]`, for compact assertions. */
const steps = (view: Awaited<ReturnType<typeof resolved>>["view"]) => view?.steps.map((s) => [s.n, s.kind, s.from, s.to, s.description]);

const rulesOf = (issues: { rule: string }[]) => issues.map((i) => i.rule);

describe("Dynamic Views in the Bundle", () => {
  it("holds each definition with every id qualified, and its source", async () => {
    const { bundle, issues } = await loadWorkspace(
      withDynamic(`flow:
  title: Place an order
  description: From the basket to the receipt
  tags: [checkout]
  participants: [shopper, web]
  steps:
    - { from: shopper, to: web }
    - { from: web, to: api, relationship: place-order, description: Submits the basket, note: Retries once }
    - { from: api, to: web, return: true }`),
    );
    expect(issues).toEqual([]);
    expect(bundle.views).toEqual([
      {
        id: "shop:flow",
        project: "shop",
        kind: "dynamic",
        title: "Place an order",
        description: "From the basket to the receipt",
        tags: ["checkout"],
        participants: ["shop:shopper", "shop:web"],
        steps: [
          { from: "shop:shopper", to: "shop:web", relationship: null, description: null, note: null, return: false },
          { from: "shop:web", to: "shop:api", relationship: "shop:place-order", description: "Submits the basket", note: "Retries once", return: false },
          { from: "shop:api", to: "shop:web", relationship: null, description: null, note: null, return: true },
        ],
        source: { file: "archidocs/shop/views.yaml", line: 3 },
      },
    ]);
  });
});

describe("Step resolution", () => {
  it("resolves a call Step to the forward Relationship, labelled with its description", async () => {
    const { issues, view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: web, to: api }");
    expect(issues).toEqual([]);
    expect(view?.steps).toEqual([
      {
        n: 1,
        kind: "call",
        from: "shop:web",
        to: "shop:api",
        relationship: expect.objectContaining({ id: "shop:place-order", from: "shop:web", to: "shop:api" }),
        interaction: "sync",
        description: "Places an order",
      },
    ]);
  });

  it("resolves a return Step to the sync Relationship the other way", async () => {
    const { issues, view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: web, to: api }\n    - { from: api, to: web, return: true, note: 201 Created }");
    expect(issues).toEqual([]);
    expect(view?.steps[1]).toEqual({
      n: 2,
      kind: "return",
      from: "shop:api",
      to: "shop:web",
      relationship: expect.objectContaining({ from: "shop:web", to: "shop:api" }),
      interaction: "sync",
      description: "Places an order",
      note: "201 Created",
    });
  });

  it("resolves an event Step, written publisher → subscriber, to the reverse `via` subscription, labelled with its channel", async () => {
    const { issues, view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: orders, to: mailer }\n    - { from: orders, to: ledger }");
    expect(issues).toEqual([]);
    expect(view?.steps[0]).toEqual({
      n: 1,
      kind: "event",
      from: "shop:orders",
      to: "shop:mailer",
      relationship: expect.objectContaining({ id: "shop:order-mail", from: "shop:mailer", to: "shop:orders" }),
      interaction: "async",
      via: "shop:bus",
      channel: "order-placed",
      description: "order-placed",
    });
    // With no channel, an event falls back to the subscription's description.
    expect(steps(view)?.[1]).toEqual([2, "event", "shop:orders", "shop:ledger", "Books the sale"]);
  });

  it("lets an author's description win over the default label", async () => {
    const { view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: orders, to: mailer, description: Order confirmed }");
    expect(steps(view)).toEqual([[1, "event", "shop:orders", "shop:mailer", "Order confirmed"]]);
  });

  it("resolves a Step between higher-level Elements over the derived edge beneath them", async () => {
    const { issues, view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: checkout, to: payments:payments }\n    - { from: payments:payments, to: checkout, return: true }");
    expect(issues).toEqual([]);
    expect(view?.steps.map((s) => [s.kind, s.from, s.to, s.relationship.from, s.relationship.to])).toEqual([
      ["call", "shop:checkout", "payments:payments", "shop:api", "payments:payments-api"],
      ["return", "payments:payments", "shop:checkout", "shop:api", "payments:payments-api"],
    ]);
  });

  it("resolves an event Step between higher-level Elements over a reverse derived edge carrying a subscription", async () => {
    const extra = {
      "shop/model.yaml": scenario["shop/model.yaml"]!.replace("  orders:\n    name: Orders\n", ""),
      "shop/fulfilment.yaml": "systems:\n  fulfilment:\n    name: Fulfilment\n    services:\n      orders:\n        name: Orders\n",
    };
    const { issues, view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: fulfilment, to: mailer }", extra);
    expect(issues).toEqual([]);
    expect(steps(view)).toEqual([[1, "event", "shop:fulfilment", "shop:mailer", "order-placed"]]);
  });

  it("orders participants by first appearance, or as `participants` fixes them", async () => {
    const steps = "  steps:\n    - { from: shopper, to: web }\n    - { from: web, to: api }\n    - { from: api, to: orders }";
    expect((await resolved(`flow:\n  title: Flow\n${steps}`)).view?.participants).toEqual(["shop:shopper", "shop:web", "shop:api", "shop:orders"]);
    expect((await resolved(`flow:\n  title: Flow\n  participants: [orders, api]\n${steps}`)).view?.participants).toEqual(["shop:orders", "shop:api", "shop:shopper", "shop:web"]);
  });
});

describe("Step problems", () => {
  it("reports `missing-step` when no Relationship or derived edge connects the pair", async () => {
    const { issues, view } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: api, to: web }");
    expect(issues).toMatchObject([{ rule: "missing-step", file: "archidocs/shop/views.yaml", line: 6, message: 'No Relationship from "shop:api" to "shop:web", nor a `via` subscription of "shop:web" to it' }]);
    expect(view?.steps).toEqual([]);
  });

  it("reports `missing-step` when the named `relationship` doesn't connect the pair", async () => {
    const { issues } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: api, to: orders, relationship: place-order }");
    expect(rulesOf(issues)).toEqual(["missing-step"]);
    expect(issues[0]!.message).toBe('Relationship "shop:place-order" doesn\'t connect "shop:api" to "shop:orders"');
  });

  it("reports `ambiguous-step` for several Relationships between the pair, unless `relationship` names one", async () => {
    const extra = { "shop/model.yaml": scenario["shop/model.yaml"]!.replace("description: Places an order\n", "description: Places an order\n          - id: track-order\n            to: api\n            description: Tracks an order\n") };
    const ambiguous = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: web, to: api }", extra);
    expect(rulesOf(ambiguous.issues)).toEqual(["ambiguous-step"]);
    expect(ambiguous.issues[0]!.message).toBe('2 Relationships match "shop:web" → "shop:api" (shop:place-order, shop:track-order); name one with `relationship`');
    const named = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: web, to: api, relationship: track-order }", extra);
    expect(named.issues).toEqual([]);
    expect(steps(named.view)).toEqual([[1, "call", "shop:web", "shop:api", "Tracks an order"]]);
  });

  it("reports `ambiguous-step` when the publisher also calls the subscriber, unless `relationship` names one", async () => {
    const extra = { "shop/model.yaml": scenario["shop/model.yaml"]!.replace("  orders:\n    name: Orders\n", "  orders:\n    name: Orders\n    relationships:\n      - id: notify\n        to: mailer\n        description: Asks for a mail\n") };
    const ambiguous = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: orders, to: mailer }", extra);
    expect(rulesOf(ambiguous.issues)).toEqual(["ambiguous-step"]);
    expect(ambiguous.issues[0]!.message).toBe('"shop:orders" → "shop:mailer" matches both a call (shop:notify) and an event (shop:order-mail); name one with `relationship`');
    const named = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: orders, to: mailer, relationship: order-mail }", extra);
    expect(named.issues).toEqual([]);
    expect(steps(named.view)).toEqual([[1, "event", "shop:orders", "shop:mailer", "order-placed"]]);
  });

  it("reports `ambiguous-step` for several subscriptions under a derived edge", async () => {
    const { issues } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: orders, to: checkout }", {
      "shop/model.yaml": scenario["shop/model.yaml"]!.replace("description: Records the order\n", "description: Records the order\n          - to: orders\n            interaction: async\n            via: bus\n            channel: order-placed\n      web-events:\n        name: Web events\n        relationships:\n          - to: orders\n            interaction: async\n            via: bus\n            channel: order-shipped\n"),
    });
    expect(rulesOf(issues)).toEqual(["ambiguous-step"]);
  });

  it("reports `return-without-relationship` when no Relationship runs the other way", async () => {
    const { issues } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: web, to: api, return: true }");
    expect(issues).toMatchObject([{ rule: "return-without-relationship", line: 6, message: 'A return from "shop:web" to "shop:api" needs a Relationship from "shop:api" to "shop:web"' }]);
  });

  it("reports `return-on-async` when a return Step resolves to an async Relationship", async () => {
    const { issues } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: orders, to: mailer, return: true }");
    expect(issues).toMatchObject([{ rule: "return-on-async", line: 6, message: 'Relationship "shop:order-mail" is async, so it has no return; model a callback as its own Relationship' }]);
  });

  it("reports `ancestor-descendant-participants` at the later of the two", async () => {
    const { issues } = await resolved("flow:\n  title: Flow\n  steps:\n    - { from: shopper, to: web }\n    - { from: web, to: api }\n    - { from: checkout, to: payments:payments }");
    expect(issues).toMatchObject([
      { rule: "ancestor-descendant-participants", line: 8, message: 'System "shop:checkout" and its descendant "shop:api" are both participants' },
      { rule: "ancestor-descendant-participants", line: 8, message: 'System "shop:checkout" and its descendant "shop:web" are both participants' },
    ]);
  });

  it("reports unknown Step and participant ids as `unknown-element`, and nothing else", async () => {
    const { issues } = await resolved("flow:\n  title: Flow\n  participants: [shoper]\n  steps:\n    - { from: web, to: apii }");
    expect(rulesOf(issues)).toEqual(["unknown-element", "unknown-element"]);
  });
});

describe("listing Dynamic Views", () => {
  it("lists a Dynamic View under `dynamic`, and for each participant and each broker an event Step runs via", async () => {
    const { bundle } = await loadWorkspace(withDynamic("flow:\n  title: Flow\n  steps:\n    - { from: api, to: orders }\n    - { from: orders, to: mailer }"));
    const flow = { id: "shop:flow", kind: "dynamic", title: "Flow" };
    expect(listViews(bundle, { kind: "dynamic" })).toEqual([flow]);
    expect(listViews(bundle, { element: "shop:bus" })).toContainEqual(flow);
    expect(listViews(bundle, { element: "shop:mailer" })).toContainEqual(flow);
    expect(listViews(bundle, { element: "shop:web" })).not.toContainEqual(flow);
  });
});
