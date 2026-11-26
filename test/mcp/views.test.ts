import { describe, expect, it } from "vitest";
import { relationshipWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";

describe("list_views", () => {
  it("lists every Generated View, filtered by kind", async () => {
    const { call, text } = await connect(relationshipWorkspace);
    const result = await call("list_views", { kind: "c2" });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      total: 3,
      truncated: false,
      views: [
        { id: "c2", kind: "c2", title: "C2 Landscape" },
        { id: "c2/payments:payments", kind: "c2", title: "Payments (C2)" },
        { id: "c2/shop:checkout", kind: "c2", title: "Checkout (C2)" },
      ],
    });
    expect(text(result)).toBe(["3 Views.", "- c2: C2 Landscape", "- c2/payments:payments: Payments (C2)", "- c2/shop:checkout: Checkout (C2)"].join("\n"));
  });

  it("with an Element, returns the Views containing it", async () => {
    const { call } = await connect(relationshipWorkspace);
    const result = await call("list_views", { element: "shop:cart-db" });

    expect(result.structuredContent).toMatchObject({ total: 3, views: [{ id: "c2" }, { id: "c2/shop:checkout" }, { id: "c3/shop:cart" }] });
  });

  it("pages with limit", async () => {
    const { call } = await connect(relationshipWorkspace);
    const result = await call("list_views", { limit: 2 });

    expect(result.structuredContent).toMatchObject({ total: 6, truncated: true, views: [{ id: "c1" }, { id: "c2" }] });
  });

  it("gives not_found for an unknown Element", async () => {
    const { call } = await connect(relationshipWorkspace);
    const result = await call("list_views", { element: "shop:crt" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ code: "not_found", message: 'No Element "shop:crt".', suggestions: ["shop:cart"] });
  });
});

describe("get_view", () => {
  it("returns the C2 Landscape with every System open, its Services inside", async () => {
    const { call } = await connect(relationshipWorkspace);
    const nodes = ((await call("get_view", { id: "c2" })).structuredContent as { nodes: { id: string; parent: string | null; collapsed: boolean }[] }).nodes;

    expect(nodes.find((n) => n.id === "shop:checkout")?.collapsed).toBe(false);
    expect(nodes.find((n) => n.id === "shop:cart")?.parent).toBe("shop:checkout");
    expect(nodes.find((n) => n.id === "payments:payments-api")?.parent).toBe("payments:payments");
  });

  it("returns a View as nodes and derived edges", async () => {
    const { call, text } = await connect(relationshipWorkspace);
    const result = await call("get_view", { id: "c3/payments:payments-api" });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      id: "c3/payments:payments-api",
      kind: "c3",
      title: "Payments API (C3)",
      direction: "LR",
      nodes: [
        { id: "payments:charges", kind: "component", name: "Charges", parent: "payments:payments-api", collapsed: false, external: false },
        { id: "payments:payments-api", kind: "service", name: "Payments API", parent: null, collapsed: false, external: false },
        { id: "shop:checkout", kind: "system", name: "Checkout", parent: null, collapsed: true, external: false },
      ],
      edges: [
        {
          from: "shop:checkout",
          to: "payments:charges",
          relationships: [
            expect.objectContaining({ id: "shop:authorise", from: "shop:checkout-ui", to: "payments:charges" }),
            expect.objectContaining({ id: "shop:capture", from: "shop:checkout-ui", to: "payments:charges" }),
            expect.objectContaining({ id: null, from: "shop:order-history", to: "payments:charges", via: "shop:events" }),
          ],
        },
      ],
    });
    expect(text(result)).toBe(
      [
        "Payments API (C3) (c3/payments:payments-api): 3 nodes, 1 edge.",
        "Nodes:",
        "- payments:charges (Charges): Component in payments:payments-api",
        "- payments:payments-api (Payments API): Service",
        "- shop:checkout (Checkout): System, collapsed",
        "Edges:",
        "- shop:checkout → payments:charges: Authorises a card; Captures a payment; Payment events",
      ].join("\n"),
    );
  });

  it("gives not_found for an unknown scope, or a scope that does not exist for that Element", async () => {
    const { call } = await connect(relationshipWorkspace);

    const scope = await call("get_view", { id: "c4/shop:cart" });
    expect(scope.isError).toBe(true);
    expect(scope.structuredContent).toEqual({ code: "not_found", message: 'No View "c4/shop:cart".', suggestions: ["c3/shop:cart"] });

    const noComponents = await call("get_view", { id: "c3/shop:web" });
    expect(noComponents.structuredContent).toMatchObject({ code: "not_found", message: 'No View "c3/shop:web".' });
  });
});
