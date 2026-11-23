import { describe, expect, it } from "vitest";
import { loadWorkspace, type Files } from "../support/workspace.ts";
import { elementTreeWorkspace } from "../support/fixtures.ts";

describe("Element tree", () => {
  it("builds the tree from nesting and `in:` across several files", async () => {
    const { bundle, issues } = await loadWorkspace(elementTreeWorkspace);

    expect(issues).toEqual([]);
    expect(bundle.elements.map((e) => [e.id, e.kind, e.parent, e.owner])).toEqual([
      ["shop:cart", "service", "shop:checkout", "storefront-team"],
      ["shop:cart-api", "component", "shop:cart", "storefront-team"],
      ["shop:cart-store", "component", "shop:cart", "storefront-team"],
      ["shop:checkout", "system", null, "storefront-team"],
      ["shop:payments", "service", "shop:checkout", "payments-team"],
      ["shop:psp", "system", null, "payments-team"],
      ["shop:psp-gateway", "service", "shop:psp", "payments-team"],
      ["shop:shopper", "person", null, "storefront-team"],
      ["shop:web", "service", null, "storefront-team"],
      ["shop:web-ui", "component", "shop:web", "storefront-team"],
    ]);
  });

  it("carries each kind's own fields", async () => {
    const { bundle } = await loadWorkspace(elementTreeWorkspace);
    const byId = (id: string) => bundle.elements.find((e) => e.id === id);

    expect(byId("shop:shopper")).toEqual({
      id: "shop:shopper",
      kind: "person",
      parent: null,
      name: "Shopper",
      description: "Buys things online.",
      owner: "storefront-team",
      tags: ["customer"],
      links: [],
      source: { file: "archidocs/shop/people.yaml", line: 2 },
    });
    expect(byId("shop:psp")).toEqual(expect.objectContaining({ kind: "system", external: true }));
    expect(byId("shop:psp")).not.toHaveProperty("technology");
    expect(byId("shop:cart")).toEqual(expect.objectContaining({ type: "app", technology: "Go", external: false }));
    expect(byId("shop:cart-store")).toEqual(expect.objectContaining({ kind: "component", technology: "Redis" }));
    expect(byId("shop:cart-store")).not.toHaveProperty("external");
  });

  it("keeps an Element's id when it is re-parented", async () => {
    const moved: Files = {
      ...elementTreeWorkspace,
      // `web` moves from the top level into the checkout System.
      "shop/web.yaml": "services:\n  web:\n    name: Web\n    in: checkout\n    components:\n      web-ui:\n        name: Web UI\n",
    };
    const before = await loadWorkspace(elementTreeWorkspace);
    const after = await loadWorkspace(moved);

    expect(after.issues).toEqual([]);
    const web = (r: typeof before) => r.bundle.elements.find((e) => e.name === "Web");
    expect(web(before)).toEqual(expect.objectContaining({ id: "shop:web", parent: null }));
    expect(web(after)).toEqual(expect.objectContaining({ id: "shop:web", parent: "shop:checkout" }));
    expect(after.bundle.elements.find((e) => e.id === "shop:web-ui")?.parent).toBe("shop:web");
  });
});

describe("invalid-nesting", () => {
  const nesting = async (files: Files) =>
    (await loadWorkspace({ ...elementTreeWorkspace, ...files })).issues.map((i) => [i.file, i.line, i.rule, i.message]);

  it("reports a collection under a kind that can't hold it, once, without a schema cascade", async () => {
    expect(await nesting({ "shop/web.yaml": "systems:\n  web:\n    name: Web\n    components:\n      web-ui:\n        name: Web UI\n" })).toEqual([
      ["archidocs/shop/web.yaml", 5, "invalid-nesting", 'Component "web-ui" can\'t sit inside System "web"; a Component goes inside a Service'],
    ]);
  });

  it("reports a Person or System that isn't at the top level", async () => {
    expect(await nesting({ "shop/web.yaml": "services:\n  web:\n    name: Web\n    people:\n      admin:\n        name: Admin\n" })).toEqual([
      ["archidocs/shop/web.yaml", 5, "invalid-nesting", 'Person "admin" can\'t sit inside Service "web"; a Person is declared only at the top level, under `people`'],
    ]);
  });

  it("reports an `in:` that names the wrong kind", async () => {
    expect(await nesting({ "shop/cart/store.yaml": "components:\n  cart-store:\n    name: Cart store\n    in: checkout\n" })).toEqual([
      ["archidocs/shop/cart/store.yaml", 4, "invalid-nesting", 'Component "cart-store" can\'t sit inside System "checkout"; `in:` must name a Service'],
    ]);
  });

  it("reports a top-level Component with no `in:`", async () => {
    expect(await nesting({ "shop/cart/store.yaml": "components:\n  cart-store:\n    name: Cart store\n" })).toEqual([
      ["archidocs/shop/cart/store.yaml", 2, "invalid-nesting", 'Component "cart-store" has no parent; nest it under a Service or add `in: <service>`'],
    ]);
  });

  it("reports `in:` on an Element that is already nested", async () => {
    expect(await nesting({ "shop/web.yaml": "services:\n  web:\n    name: Web\n    components:\n      web-ui:\n        name: Web UI\n        in: cart\n" })).toEqual([
      ["archidocs/shop/web.yaml", 7, "invalid-nesting", 'Component "web-ui" is nested under Service "web" and also names `in: cart`; remove `in:`'],
    ]);
  });
});

describe("`in:` naming no Element", () => {
  it("is reported as unknown-element with the nearest id", async () => {
    const { issues } = await loadWorkspace({ ...elementTreeWorkspace, "shop/cart/store.yaml": "components:\n  cart-store:\n    name: Cart store\n    in: carts\n" });
    expect(issues.map((i) => [i.file, i.line, i.rule, i.message])).toEqual([
      ["archidocs/shop/cart/store.yaml", 4, "unknown-element", 'Unknown Element "carts" in Project "shop"; did you mean "cart"?'],
    ]);
  });
});

describe("external-with-components", () => {
  it("reports a Component attached with `in:` to an External Service", async () => {
    const { issues } = await loadWorkspace({
      ...elementTreeWorkspace,
      "shop/psp-parts.yaml": "components:\n  psp-sdk:\n    name: PSP SDK\n    in: psp-gateway\n",
    });
    expect(issues.map((i) => [i.file, i.line, i.rule, i.message])).toEqual([
      ["archidocs/shop/psp-parts.yaml", 2, "external-with-components", 'Component "psp-sdk" is inside External Service "psp-gateway"; an External Element can\'t contain declared Components'],
    ]);
  });
});

describe("duplicate-id", () => {
  it("is reported across files and kinds, for nested Elements too", async () => {
    const { issues } = await loadWorkspace({
      ...elementTreeWorkspace,
      "shop/z-more.yaml": "services:\n  ops:\n    name: Ops\n    components:\n      cart:\n        name: Cart again\n",
    });
    expect(issues.map((i) => [i.file, i.line, i.rule, i.message])).toEqual([
      ["archidocs/shop/z-more.yaml", 5, "duplicate-id", 'Id "cart" is already declared in Project "shop" at archidocs/shop/systems.yaml:5'],
    ]);
  });
});
