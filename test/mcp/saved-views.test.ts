import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";
import type { Files } from "../support/workspace.ts";

/** The landscape fixture with a commented file of Saved Views in an `architecture` Project. */
const workspace: Files = {
  ...landscapeWorkspace,
  "architecture/project.yaml": "id: architecture\nname: Architecture\nowner: platform-team\n",
  "architecture/views.yaml": `# Views the architecture group curates.
views:
  structural:
    purchase:
      title: Purchase # shown in the Views tree
      level: c2
      include:
        # Everything between the shopper and the money.
        - { from: shop:shopper, to: payments:payments-api }
      direction: TB
      lens: { impact: shop:cart, direction: upstream }
    runtime:
      title: Runtime
      level: deployment
      environment: prod
`,
};

async function setup(files: Files = workspace) {
  const session = await connect(files);
  const read = (path: string) => readFile(join(session.root, path), "utf8");
  return { ...session, read };
}

describe("list_views", () => {
  it("lists Saved Views after the Generated ones, under their level", async () => {
    const { call } = await setup();

    expect((await call("list_views", { kind: "deployment" })).structuredContent).toEqual({
      total: 1,
      truncated: false,
      views: [{ id: "architecture:runtime", kind: "deployment", title: "Runtime" }],
    });
    expect((await call("list_views", { element: "shop:web" })).structuredContent).toMatchObject({ views: expect.arrayContaining([{ id: "architecture:purchase", kind: "c2", title: "Purchase" }]) });
  });
});

describe("get_view", () => {
  it("returns a Saved View with its Lens, a mark per node and lit per edge", async () => {
    const { call, text } = await setup();
    const result = await call("get_view", { id: "architecture:purchase" });

    expect(result.isError).toBeFalsy();
    const view = result.structuredContent as { nodes: { id: string; mark: unknown }[]; edges: { from: string; to: string; lit: boolean }[] };
    expect(result.structuredContent).toMatchObject({ id: "architecture:purchase", kind: "c2", title: "Purchase", direction: "TB", lens: { impact: "shop:cart", direction: "upstream" } });
    expect(view.nodes.map((n) => [n.id, n.mark])).toEqual([
      ["payments:payments-api", { hit: false }],
      ["shop:cart", { hit: true, distance: 0 }],
      ["shop:shopper", { hit: true, distance: 2 }],
      ["shop:web", { hit: true, distance: 1 }],
    ]);
    expect(view.edges.map((e) => [e.from, e.to, e.lit])).toEqual([
      ["shop:cart", "payments:payments-api", false],
      ["shop:shopper", "shop:web", true],
      ["shop:web", "shop:cart", true],
    ]);
    expect(text(result)).toContain("Lens: impact of shop:cart, upstream.");
    expect(text(result)).toContain("- shop:web (Web): Service, hit at distance 1");
  });

  it("says a Saved Deployment View can't be resolved yet", async () => {
    const { call } = await setup();
    const result = await call("get_view", { id: "architecture:runtime" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "invalid_input" });
  });
});

describe("upsert_view", () => {
  it("adds a View to model.yaml, and get_view resolves it", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_view", {
      project: "shop",
      id: "front-door",
      definition: { title: "Front door", level: "c2", include: ["shopper", { element: "web", downstream: 1 }] },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ action: "created", id: "shop:front-door", files: ["archidocs/shop/model.yaml"] });
    expect(await read("shop/model.yaml")).toBe(`views:
  structural:
    front-door:
      title: Front door
      level: c2
      include:
        - shopper
        - element: web
          downstream: 1
`);
    const view = await call("get_view", { id: "shop:front-door" });
    expect((view.structuredContent as { nodes: { id: string }[] }).nodes.map((n) => n.id)).toEqual(["shop:cart", "shop:shopper", "shop:web"]);
  });

  it("updates a View in place, keeping comments and the keys it leaves unchanged", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_view", {
      project: "architecture",
      id: "purchase",
      definition: {
        title: "Purchase",
        level: "c1",
        include: [{ from: "shop:shopper", to: "payments:payments-api" }],
        direction: "TB",
      },
    });

    expect(result.structuredContent).toMatchObject({ action: "updated", id: "architecture:purchase" });
    expect(await read("architecture/views.yaml")).toBe(`# Views the architecture group curates.
views:
  structural:
    purchase:
      title: Purchase # shown in the Views tree
      level: c1
      include:
        # Everything between the shopper and the money.
        - { from: shop:shopper, to: payments:payments-api }
      direction: TB
    runtime:
      title: Runtime
      level: deployment
      environment: prod
`);
  });

  it("round-trips: writing back the definition it read changes nothing", async () => {
    const { call, read } = await setup();
    const before = await read("architecture/views.yaml");
    const result = await call("upsert_view", {
      project: "architecture",
      id: "purchase",
      definition: { title: "Purchase", level: "c2", include: [{ from: "shop:shopper", to: "payments:payments-api" }], direction: "TB", lens: { impact: "shop:cart", direction: "upstream" } },
    });

    expect(result.structuredContent).toMatchObject({ action: "unchanged", diff: "" });
    expect(await read("architecture/views.yaml")).toBe(before);
  });

  it("refuses a definition that doesn't match the schema", async () => {
    const { call } = await setup();
    const result = await call("upsert_view", { project: "shop", id: "v", definition: { title: "V", level: "c4" } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "invalid_input" });
  });

  it("refuses a View that would introduce an error, with the issues", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_view", { project: "shop", id: "v", definition: { title: "V", level: "c2", include: ["wbe"] } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", issues: [{ rule: "unknown-element", file: "archidocs/shop/model.yaml" }] });
    await expect(read("shop/model.yaml")).rejects.toThrow();
  });

  it("writes a new View into the file given", async () => {
    const { call } = await setup();
    const result = await call("upsert_view", { project: "shop", id: "v", definition: { title: "V", level: "c1" }, file: "views.yaml", dry_run: true });

    expect(result.structuredContent).toMatchObject({ action: "created", files: ["archidocs/shop/views.yaml"], dryRun: true });
  });
});

describe("remove_view", () => {
  it("removes a View, keeping the rest of the file", async () => {
    const { call, read } = await setup();
    const result = await call("remove_view", { project: "architecture", id: "runtime" });

    expect(result.structuredContent).toMatchObject({ action: "removed", id: "architecture:runtime" });
    expect(await read("architecture/views.yaml")).not.toContain("runtime:");
    expect(await read("architecture/views.yaml")).toContain("# Everything between the shopper and the money.");
  });

  it("gives not_found for an unknown View, with a suggestion", async () => {
    const { call } = await setup();
    const result = await call("remove_view", { project: "architecture", id: "purchse" });

    expect(result.structuredContent).toEqual({ code: "not_found", message: 'No View "architecture:purchse".', suggestions: ["architecture:purchase"] });
  });
});
