import { describe, expect, it } from "vitest";
import { listViews } from "../../src/core/index.ts";
import { structuralView } from "../support/views.ts";
import { deploymentViewWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const load = async () => {
  const { bundle, issues } = await loadWorkspace(deploymentViewWorkspace);
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  return bundle;
};

/** Edges as `from > to`, for compact assertions. */
const edges = (view: ReturnType<typeof structuralView>) => view?.edges.map((e) => `${e.from} > ${e.to}`);

describe("the Deployment View of an Environment", () => {
  it("nests Targets as containers, with each System's Deployments in a System box inside each Target", async () => {
    const view = structuralView(await load(), "deployment/prod");

    expect(view).toMatchObject({ id: "deployment/prod", kind: "deployment", title: "Production (Deployment)", direction: "TB" });
    expect(view?.nodes.map((n) => [n.id, n.kind, n.parent, n.element ?? null])).toEqual([
      ["payments:payments-api@platform:eks-us", "deployment", "platform:eks-us", "payments:payments-api"],
      ["payments:payments-api@platform:ns-pay", "deployment", "platform:ns-pay", "payments:payments-api"],
      ["payments:stripe", "service", null, null],
      ["platform:aws-eu", "target", null, null],
      ["platform:aws-us", "target", null, null],
      ["platform:dc", "target", null, null],
      ["platform:eks-eu", "target", "platform:aws-eu", null],
      ["platform:eks-us", "target", "platform:aws-us", null],
      ["platform:ns-pay", "target", "platform:eks-eu", null],
      ["platform:ns-shop", "target", "platform:eks-eu", null],
      ["shop:analytics@platform:dc", "deployment", "platform:dc", "shop:analytics"],
      ["shop:cart@platform:eks-us", "deployment", "shop:checkout@platform:eks-us", "shop:cart"],
      ["shop:cart@platform:ns-shop", "deployment", "shop:checkout@platform:ns-shop", "shop:cart"],
      ["shop:checkout@platform:eks-us", "system", "platform:eks-us", "shop:checkout"],
      ["shop:checkout@platform:ns-shop", "system", "platform:ns-shop", "shop:checkout"],
      ["shop:search", "service", null, null],
      ["shop:web@platform:eks-us", "deployment", "shop:checkout@platform:eks-us", "shop:web"],
      ["shop:web@platform:ns-shop", "deployment", "shop:checkout@platform:ns-shop", "shop:web"],
    ]);
    expect(view?.nodes.find((n) => n.id === "shop:web@platform:ns-shop")).toMatchObject({ name: "Web", collapsed: false, external: false });
    expect(view?.nodes.find((n) => n.id === "platform:eks-eu")).toMatchObject({ name: "EKS eu", collapsed: false });
  });

  it("connects a consumer Deployment to the provider Deployments under their deepest shared Target", async () => {
    const view = structuralView(await load(), "deployment/prod");

    expect(edges(view)).toContain("shop:web@platform:ns-shop > shop:cart@platform:ns-shop");
    expect(edges(view)).toContain("shop:web@platform:eks-us > shop:cart@platform:eks-us");
    // Cart's Component calls Payments API: the shared cluster beats the shared nothing in the US.
    expect(edges(view)).toContain("shop:cart@platform:ns-shop > payments:payments-api@platform:ns-pay");
    expect(edges(view)).not.toContain("shop:cart@platform:ns-shop > payments:payments-api@platform:eks-us");
    expect(view?.edges.find((e) => e.from === "shop:cart@platform:ns-shop")?.relationships.map((r) => r.description)).toEqual(["Takes payment"]);
  });

  it("connects to every provider Deployment in the Environment when no Target is shared", async () => {
    const view = structuralView(await load(), "deployment/prod");

    expect(edges(view)?.filter((e) => e.startsWith("shop:analytics"))).toEqual([
      "shop:analytics@platform:dc > payments:payments-api@platform:eks-us",
      "shop:analytics@platform:dc > payments:payments-api@platform:ns-pay",
    ]);
  });

  it("draws a related Service with no Deployment in the Environment, such as an External provider, as a logical node outside every Target", async () => {
    const view = structuralView(await load(), "deployment/prod");

    expect(view?.nodes.find((n) => n.id === "payments:stripe")).toMatchObject({ kind: "service", parent: null, external: true });
    expect(edges(view)?.filter((e) => e.endsWith("payments:stripe"))).toEqual([
      "payments:payments-api@platform:eks-us > payments:stripe",
      "payments:payments-api@platform:ns-pay > payments:stripe",
    ]);
    expect(edges(view)?.filter((e) => e.endsWith("shop:search"))).toEqual(["shop:web@platform:eks-us > shop:search", "shop:web@platform:ns-shop > shop:search"]);
    // Persons aren't deployed and aren't drawn.
    expect(view?.nodes.some((n) => n.id === "shop:shopper")).toBe(false);
  });

  it("holds only that Environment's Deployments", async () => {
    const view = structuralView(await load(), "deployment/staging");

    expect(view?.nodes.map((n) => n.id)).toEqual(["platform:aws-eu", "platform:eks-eu", "shop:cart", "shop:checkout@platform:eks-eu", "shop:search", "shop:web@platform:eks-eu"]);
    expect(edges(view)).toEqual(["shop:web@platform:eks-eu > shop:cart", "shop:web@platform:eks-eu > shop:search"]);
  });

  it("is listed once per Environment, after the structural Generated Views", async () => {
    const bundle = await load();
    expect(listViews(bundle, { kind: "deployment" })).toEqual([
      { id: "deployment/prod", kind: "deployment", title: "Production (Deployment)" },
      { id: "deployment/staging", kind: "deployment", title: "Staging (Deployment)" },
    ]);
    expect(listViews(bundle, { element: "shop:analytics" }).map((v) => v.id)).toContain("deployment/prod");
    expect(listViews(bundle, { element: "shop:analytics" }).map((v) => v.id)).not.toContain("deployment/staging");
    expect(structuralView(bundle, "deployment/qa")).toBeUndefined();
  });
});

describe("a Saved Deployment View", () => {
  const withViews = (views: string) => loadWorkspace({ ...deploymentViewWorkspace, "shop/views.yaml": `views:\n  structural:\n${views}` });

  it("keeps the Deployments in its `targets` subtrees; a related Service deployed elsewhere is a logical node", async () => {
    const { bundle, issues } = await withViews(`    eu:
      title: EU
      level: deployment
      environment: prod
      targets: [platform:aws-eu]
`);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    const view = structuralView(bundle, "shop:eu");

    expect(view).toMatchObject({ id: "shop:eu", kind: "deployment", title: "EU", direction: "TB" });
    expect(view?.nodes.map((n) => n.id)).toEqual([
      "payments:payments-api@platform:ns-pay",
      "payments:stripe",
      "platform:aws-eu",
      "platform:eks-eu",
      "platform:ns-pay",
      "platform:ns-shop",
      "shop:analytics",
      "shop:cart@platform:ns-shop",
      "shop:checkout@platform:ns-shop",
      "shop:search",
      "shop:web@platform:ns-shop",
    ]);
    expect(edges(view)).toContain("shop:analytics > payments:payments-api@platform:ns-pay");
  });

  it("draws the Deployments of the Services `include` selects, leaving out what `exclude` selects with its Relationships", async () => {
    const { bundle } = await withViews(`    checkout:
      title: Checkout runtime
      level: deployment
      environment: prod
      include: [checkout]
      exclude: [search]
      direction: LR
`);
    const view = structuralView(bundle, "shop:checkout");

    expect(view?.direction).toBe("LR");
    expect(view?.nodes.filter((n) => n.kind === "deployment").map((n) => n.id)).toEqual([
      "shop:cart@platform:eks-us",
      "shop:cart@platform:ns-shop",
      "shop:web@platform:eks-us",
      "shop:web@platform:ns-shop",
    ]);
    expect(view?.nodes.filter((n) => n.kind !== "deployment" && n.kind !== "target" && n.kind !== "system").map((n) => n.id)).toEqual(["payments:payments-api"]);
  });
});

describe("a Deployment View's facts", () => {
  it("a Generated Deployment View carries its Environment, and each Deployment node its Deployment Target", async () => {
    const view = structuralView(await load(), "deployment/prod")!;
    expect(view.environment).toBe("prod");
    expect(view.nodes.filter((n) => n.kind === "deployment").map((n) => [n.element, n.target])).toEqual([
      ["payments:payments-api", "platform:eks-us"],
      ["payments:payments-api", "platform:ns-pay"],
      ["shop:analytics", "platform:dc"],
      ["shop:cart", "platform:eks-us"],
      ["shop:cart", "platform:ns-shop"],
      ["shop:web", "platform:eks-us"],
      ["shop:web", "platform:ns-shop"],
    ]);
  });

  it("a Saved Deployment View carries its Environment, and each Deployment node its Deployment Target", async () => {
    const { bundle } = await loadWorkspace({
      ...deploymentViewWorkspace,
      "shop/views.yaml": `views:\n  structural:\n    staging:\n      title: Staging\n      level: deployment\n      environment: staging\n`,
    });
    const view = structuralView(bundle, "shop:staging")!;
    expect(view.environment).toBe("staging");
    expect(view.nodes.filter((n) => n.kind === "deployment").map((n) => [n.element, n.target])).toEqual([["shop:web", "platform:eks-eu"]]);
  });

  it("a View of any other kind has no Environment, and its nodes no Deployment Target", async () => {
    const view = structuralView(await load(), "c2")!;
    expect(view.environment).toBeUndefined();
    expect(view.nodes.some((n) => n.target !== undefined)).toBe(false);
  });
});

describe("a Lens over a Deployment View", () => {
  it("marks every Deployment of a Service the Lens reaches, and lights edges as on any View", async () => {
    const bundle = await load();
    const view = structuralView(bundle, "deployment/prod", { lens: { impact: "payments:payments-api", direction: "upstream" } });
    const hit = view?.nodes.filter((n) => n.mark?.hit).map((n) => [n.id, n.mark?.distance]);

    expect(hit).toEqual([
      ["payments:payments-api@platform:eks-us", 0],
      ["payments:payments-api@platform:ns-pay", 0],
      ["shop:analytics@platform:dc", 1],
      ["shop:cart@platform:eks-us", 1],
      ["shop:cart@platform:ns-shop", 1],
      ["shop:web@platform:eks-us", 2],
      ["shop:web@platform:ns-shop", 2],
    ]);
    expect(view?.edges.find((e) => e.from === "shop:cart@platform:ns-shop" && e.to === "payments:payments-api@platform:ns-pay")?.lit).toBe(true);
    expect(view?.edges.find((e) => e.to === "payments:stripe")?.lit).toBe(false);
  });

  it("with a Team Lens, also rings the Deployment Targets the Team owns", async () => {
    const view = structuralView(await load(), "deployment/prod", { lens: { team: "platform-team" } });

    expect(view?.nodes.filter((n) => n.mark?.hit).map((n) => n.id)).toEqual(["platform:aws-eu", "platform:aws-us", "platform:dc", "platform:eks-eu", "platform:eks-us", "platform:ns-pay", "platform:ns-shop"]);
  });
});
