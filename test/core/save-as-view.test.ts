import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { saveAsView, type Screen } from "../../src/core/index.ts";
import { structuralView } from "../support/views.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";
import { deploymentViewWorkspace, landscapeWorkspace } from "../support/fixtures.ts";

const screen = (s: Partial<Screen> & Pick<Screen, "view">): Screen => ({ open: [], lens: null, picks: [], direction: null, ...s });
const ids = (view: ReturnType<typeof structuralView>) => view?.nodes.map((n) => n.id) ?? [];

/** Saves the screen, writes its YAML into the shop Project and loads it again: the Saved View as the core engine resolves it. */
async function saved(s: Screen, files: Files = landscapeWorkspace) {
  const { bundle } = await loadWorkspace(files);
  const out = saveAsView(bundle, s, { project: "shop", id: "saved", title: "Saved" });
  const reloaded = await loadWorkspace({ ...files, "shop/saved.yaml": out.yaml });
  expect(reloaded.issues.filter((i) => i.severity === "error")).toEqual([]);
  return { ...out, bundle, view: structuralView(reloaded.bundle, "shop:saved"), screenView: structuralView(bundle, s.view, { expand: s.open, ...(s.lens ? { lens: s.lens } : {}) }) };
}

describe("Save as View", () => {
  it("turns open boxes into expand, and resolves to the screen's nodes", async () => {
    const { definition, view } = await saved(screen({ view: "c2", open: ["shop:checkout"] }));
    expect(definition).toMatchObject({ title: "Saved", level: "c2", expand: ["checkout"] });
    expect(ids(view)).toEqual([
      "payments:payments",
      "shop:cart",
      "shop:cart-db",
      "shop:checkout",
      "shop:events",
      "shop:fraud-check",
      "shop:order-history",
      "shop:shopper",
      "shop:web",
    ]);
  });

  it("writes the YAML under views: structural: and the matching upsert_view call", async () => {
    const { yaml, call, definition } = await saved(screen({ view: "c2", open: ["shop:checkout"] }));
    expect(parse(yaml)).toEqual({ views: { structural: { saved: definition } } });
    expect(call).toEqual({ tool: "upsert_view", arguments: { project: "shop", id: "saved", definition } });
  });

  it("turns picks into ids, keeping their open containers", async () => {
    const { definition, view } = await saved(screen({ view: "c2", open: ["shop:checkout"], picks: ["shop:cart", "shop:web"] }));
    expect(definition).not.toHaveProperty("expand");
    expect(definition.include).toEqual(expect.arrayContaining(["cart", "web", "checkout"]));
    expect(ids(view)).toEqual(["shop:cart", "shop:checkout", "shop:web"]);
    expect(view?.nodes.find((n) => n.id === "shop:cart")?.parent).toBe("shop:checkout");
  });

  it("picks a Component inside an open Service on the C2 Landscape", async () => {
    const { view } = await saved(screen({ view: "c2", open: ["shop:checkout", "shop:cart"], picks: ["shop:checkout-ui", "shop:web"] }));
    expect(ids(view)).toEqual(["shop:cart", "shop:checkout", "shop:checkout-ui", "shop:web"]);
  });

  it("turns an Impact Lens into upstream/downstream: all and keeps it as lens:", async () => {
    const lens = { impact: "shop:cart", direction: "upstream" as const };
    const { definition, view, screenView } = await saved(screen({ view: "c2", open: ["shop:checkout"], lens }));
    expect(definition.include).toContainEqual({ element: "cart", upstream: "all" });
    expect(definition.lens).toEqual({ impact: "cart", direction: "upstream" });
    expect(ids(view)).toEqual(ids(screenView));
    expect(view?.nodes.filter((n) => n.mark?.hit).map((n) => n.id)).toEqual(["shop:cart", "shop:shopper", "shop:web"]);
  });

  it("writes both ways of an Impact Lens", async () => {
    const { definition } = await saved(screen({ view: "c2", lens: { impact: "shop:cart", direction: "both" } }));
    expect(definition.include).toContainEqual({ element: "cart", upstream: "all", downstream: "all" });
  });

  it("turns a Team Lens into {team}", async () => {
    const { definition, view, screenView } = await saved(screen({ view: "c2/shop:checkout", lens: { team: "payments-team" } }));
    expect(definition.include).toContainEqual({ team: "payments-team" });
    expect(definition.lens).toEqual({ team: "payments-team" });
    expect(ids(view)).toEqual(ids(screenView));
  });

  it("turns Connect to… into a path selector, with its picks", async () => {
    const lens = { path: { from: "shop:shopper", to: "shop:cart-db", paths: "shortest" as const } };
    const { bundle } = await loadWorkspace(landscapeWorkspace);
    const picks = structuralView(bundle, "c2", { expand: ["shop:checkout"], lens })!.nodes.filter((n) => n.mark?.hit).map((n) => n.id);
    const { definition, view } = await saved(screen({ view: "c2", open: ["shop:checkout"], lens, picks }));
    expect(definition.include).toEqual([{ from: "shopper", to: "cart-db", paths: "shortest" }, "checkout"]);
    expect(definition.lens).toEqual({ path: { from: "shopper", to: "cart-db", paths: "shortest" } });
    expect(ids(view)).toEqual(["shop:cart", "shop:cart-db", "shop:checkout", "shop:shopper", "shop:web"]);
  });

  it("keeps a direction the screen turned", async () => {
    const { definition, view } = await saved(screen({ view: "c1", direction: "TB" }));
    expect(definition.direction).toBe("TB");
    expect(view?.direction).toBe("TB");
  });

  it("saves a Saved View afresh with the Lens the screen has", async () => {
    const files: Files = {
      ...landscapeWorkspace,
      "shop/views.yaml": `views:\n  structural:\n    mine:\n      title: Mine\n      level: c2\n      include: [{ element: checkout, with: children }]\n      lens: { team: payments-team }\n`,
    };
    const { definition, view, bundle } = await saved(screen({ view: "shop:mine", lens: null }), files);
    expect(definition).not.toHaveProperty("lens");
    expect(ids(view)).toEqual(ids(structuralView(bundle as Bundle, "shop:mine")));
  });

  it("saves an Environment's Deployment View as level: deployment over that Environment", async () => {
    const { definition, view, screenView } = await saved(screen({ view: "deployment/prod" }), deploymentViewWorkspace);
    expect(definition).toEqual({ title: "Saved", level: "deployment", environment: "prod" });
    expect(ids(view)).toEqual(ids(screenView));
  });

  it("keeps the Lens on a Deployment View as lens:, marking the same nodes", async () => {
    const lens = { impact: "shop:cart", direction: "upstream" as const };
    const { definition, view, screenView } = await saved(screen({ view: "deployment/prod", lens }), deploymentViewWorkspace);
    expect(definition.lens).toEqual({ impact: "cart", direction: "upstream" });
    expect(ids(view)).toEqual(ids(screenView));
    const hits = (v: typeof view) => v?.nodes.filter((n) => n.mark?.hit).map((n) => n.id);
    expect(hits(view)).toEqual(hits(screenView));
  });

  it("refuses picks on a Deployment View, which a Saved View can't keep node by node", async () => {
    const { bundle } = await loadWorkspace(deploymentViewWorkspace);
    expect(() => saveAsView(bundle, screen({ view: "deployment/prod", picks: ["shop:web@platform:ns-shop"] }), { project: "shop", id: "saved", title: "Saved" })).toThrow(
      "Save as View keeps a whole Deployment View; clear the picks first.",
    );
  });
});
