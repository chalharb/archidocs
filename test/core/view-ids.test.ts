import { describe, expect, it } from "vitest";
import { formatViewId, ownViewId, parseViewId, resolveView } from "../../src/core/index.ts";
import { checkoutScenarioWorkspace, deploymentViewWorkspace, relationshipWorkspace, viewerWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

describe("the View id grammar", () => {
  it("reads each form of View id", () => {
    expect(parseViewId("c1")).toEqual({ form: "landscape", level: "c1" });
    expect(parseViewId("c2")).toEqual({ form: "landscape", level: "c2" });
    expect(parseViewId("c2/shop:checkout")).toEqual({ form: "focused", level: "c2", element: "shop:checkout" });
    expect(parseViewId("c3/shop:cart")).toEqual({ form: "focused", level: "c3", element: "shop:cart" });
    expect(parseViewId("deployment/prod")).toEqual({ form: "deployment", environment: "prod" });
    expect(parseViewId("shop:cart-flow")).toEqual({ form: "saved", id: "shop:cart-flow" });
  });

  it("reads nothing from a string in none of the forms", () => {
    for (const id of ["", "c3", "c4", "nonsense", "c2/", "c3/", "deployment/", "c1/shop:checkout"]) expect(parseViewId(id), id).toBeUndefined();
  });

  it("writes back the id it read", () => {
    for (const id of ["c1", "c2", "c2/shop:checkout", "c3/shop:cart", "deployment/prod", "shop:cart-flow"]) expect(formatViewId(parseViewId(id)!)).toBe(id);
  });
});

describe("an Element's own View", () => {
  it("is the System's C2, a Service with Components' C3, else the C2 of the System it sits in", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    expect(ownViewId(bundle, "shop:checkout")).toBe("c2/shop:checkout");
    expect(ownViewId(bundle, "shop:cart")).toBe("c3/shop:cart");
    expect(ownViewId(bundle, "shop:cart-db")).toBe("c2/shop:checkout");
    expect(ownViewId(bundle, "shop:checkout-ui")).toBe("c2/shop:checkout");
  });

  it("is none for a Person, a Service outside any System and an unknown Element", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    expect(ownViewId(bundle, "shop:shopper")).toBeUndefined();
    expect(ownViewId(bundle, "shop:web")).toBeUndefined();
    expect(ownViewId(bundle, "shop:nope")).toBeUndefined();
  });

  it("is always a View that resolves", async () => {
    const { bundle } = await loadWorkspace(relationshipWorkspace);
    for (const e of bundle.elements) {
      const own = ownViewId(bundle, e.id);
      if (own !== undefined) expect(resolveView(bundle, own), own).toBeDefined();
    }
  });
});

describe("resolving any View id", () => {
  it("gives a Dynamic View for a Dynamic View's id", async () => {
    const { bundle } = await loadWorkspace(checkoutScenarioWorkspace);
    const view = resolveView(bundle, "shop:full-checkout");
    expect(view).toMatchObject({ id: "shop:full-checkout", kind: "dynamic" });
    expect(view?.kind === "dynamic" && view.steps.length).toBeGreaterThan(0);
  });

  it("gives a Structural View for each Generated form", async () => {
    const { bundle } = await loadWorkspace(deploymentViewWorkspace);
    const system = bundle.elements.find((e) => e.kind === "system")!;
    const service = bundle.elements.find((e) => e.kind === "service" && bundle.elements.some((c) => c.parent === e.id));
    expect(resolveView(bundle, "c1")?.kind).toBe("c1");
    expect(resolveView(bundle, "c2")?.kind).toBe("c2");
    expect(resolveView(bundle, `c2/${system.id}`)?.kind).toBe("c2");
    if (service) expect(resolveView(bundle, `c3/${service.id}`)?.kind).toBe("c3");
    expect(resolveView(bundle, `deployment/${bundle.environments[0]!.id}`)?.kind).toBe("deployment");
  });

  it("gives a Structural View at its level for a Saved Structural View", async () => {
    const { bundle } = await loadWorkspace(viewerWorkspace);
    const saved = bundle.views.filter((v) => v.kind === "structural");
    expect(saved.length).toBeGreaterThan(0);
    for (const def of saved) expect(resolveView(bundle, def.id)).toMatchObject({ id: def.id, kind: def.level });
  });

  it("gives nothing for an unknown id", async () => {
    const { bundle } = await loadWorkspace(checkoutScenarioWorkspace);
    for (const id of ["shop:nope", "c2/shop:nope", "deployment/nope", "nonsense"]) expect(resolveView(bundle, id), id).toBeUndefined();
  });
});
