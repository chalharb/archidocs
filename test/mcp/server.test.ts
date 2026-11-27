import { execFileSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { elementTreeWorkspace, validWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";

describe("get_workspace_info", () => {
  it("reports the checkout source, its commit and that writes are allowed", async () => {
    const { call, text, commit, root } = await connect(validWorkspace);
    const result = await call("get_workspace_info");
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      source: { kind: "checkout", root },
      commit,
      writesAllowed: true,
      counts: { projects: 2, elements: 4, teams: 2, environments: 2 },
      issues: { errors: 0, warnings: 0 },
    });
    expect(text(result)).toContain(`checkout at ${commit.slice(0, 7)}`);
  });
});

describe("a checkout source", () => {
  it("rebuilds the Bundle when a file is added, edited or removed", async () => {
    const { call, root } = await connect(validWorkspace);
    const elements = async () => ((await call("get_workspace_info")).structuredContent!.counts as { elements: number }).elements;
    expect(await elements()).toBe(4);

    await writeFile(join(root, "shop/cart.yaml"), "services:\n  cart:\n    name: Cart\n");
    expect(await elements()).toBe(5);

    await writeFile(join(root, "shop/cart.yaml"), "services:\n  cart:\n    name: Cart\n  basket:\n    name: Basket\n");
    expect(await elements()).toBe(6);

    await rm(join(root, "shop/cart.yaml"));
    expect(await elements()).toBe(4);
  });

  it("reports the new commit after HEAD moves", async () => {
    const { call, repoRoot, commit } = await connect(validWorkspace);
    expect((await call("get_workspace_info")).structuredContent!.commit).toBe(commit);
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "Next"], { cwd: repoRoot });
    const next = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    expect((await call("get_workspace_info")).structuredContent!.commit).toBe(next);
  });
});

describe("get_element", () => {
  it("returns an Element's fields, Owner, parent, children and source", async () => {
    const { call, text } = await connect(elementTreeWorkspace);
    const result = await call("get_element", { id: "shop:cart" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      adrs: [],
      element: {
        id: "shop:cart",
        kind: "service",
        parent: "shop:checkout",
        name: "Cart",
        description: null,
        owner: "storefront-team",
        tags: [],
        links: [],
        metadata: {},
        type: "app",
        technology: "Go",
        external: false,
        repository: null,
        source: { file: "archidocs/shop/systems.yaml", line: 5 },
      },
      owner: { id: "storefront-team", name: "Storefront" },
      parent: { id: "shop:checkout", kind: "system", name: "Checkout" },
      children: [
        { id: "shop:cart-api", kind: "component", name: "Cart API" },
        { id: "shop:cart-store", kind: "component", name: "Cart store" },
      ],
      deployments: [],
      relationships: { in: [], out: [] },
      derived: { in: [], out: [] },
      dynamicViews: [],
    });
    expect(text(result)).toBe(
      [
        "Service shop:cart (Cart), owned by storefront-team, in shop:checkout; archidocs/shop/systems.yaml:5.",
        "- technology: Go",
        "- children: shop:cart-api (Cart API), shop:cart-store (Cart store)",
      ].join("\n"),
    );
  });

  it("returns a top-level Element with no parent and no children", async () => {
    const { call } = await connect(elementTreeWorkspace);
    const { structuredContent } = await call("get_element", { id: "shop:shopper" });
    expect(structuredContent).toMatchObject({ element: { kind: "person", tags: ["customer"] }, parent: null, children: [] });
  });

  it("links to the viewer when a viewer base URL is configured", async () => {
    const { call } = await connect(elementTreeWorkspace, { viewerUrl: "https://arch.example.com/" });
    const { structuredContent } = await call("get_element", { id: "shop:cart" });
    expect(structuredContent!.viewerUrl).toBe("https://arch.example.com/#/element/shop:cart");
  });

  it("gives not_found with suggestions for an unknown or unqualified id", async () => {
    const { call, text } = await connect(elementTreeWorkspace);
    const typo = await call("get_element", { id: "shop:crt" });
    expect(typo.isError).toBe(true);
    expect(typo.structuredContent).toEqual({ code: "not_found", message: 'No Element "shop:crt".', suggestions: ["shop:cart"] });
    expect(text(typo)).toBe('not_found: No Element "shop:crt".\nDid you mean: shop:cart?');

    const bare = await call("get_element", { id: "cart" });
    expect(bare.structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop:cart"] });

    const nothingClose = await call("get_element", { id: "billing:ledger" });
    expect(nothingClose.structuredContent).toEqual({ code: "not_found", message: 'No Element "billing:ledger".' });
  });
});

describe("search_elements", () => {
  it("matches ids and names, best match first", async () => {
    const { call, text } = await connect(elementTreeWorkspace);
    const result = await call("search_elements", { query: "cart" });
    expect(result.structuredContent).toEqual({
      query: "cart",
      total: 3,
      truncated: false,
      elements: [
        { id: "shop:cart", kind: "service", name: "Cart", owner: "storefront-team", parent: "shop:checkout" },
        { id: "shop:cart-api", kind: "component", name: "Cart API", owner: "storefront-team", parent: "shop:cart" },
        { id: "shop:cart-store", kind: "component", name: "Cart store", owner: "storefront-team", parent: "shop:cart" },
      ],
    });
    expect(text(result)).toBe(
      [
        '3 Elements match "cart".',
        "- shop:cart (Cart): Service, storefront-team",
        "- shop:cart-api (Cart API): Component, storefront-team",
        "- shop:cart-store (Cart store): Component, storefront-team",
      ].join("\n"),
    );

    const byName = await call("search_elements", { query: "PAYMENT" });
    expect((byName.structuredContent!.elements as { id: string }[]).map((e) => e.id)).toEqual(["shop:payments", "shop:psp"]);
  });

  it("filters by kind", async () => {
    const { call } = await connect(elementTreeWorkspace);
    const result = await call("search_elements", { query: "cart", kind: "component" });
    expect((result.structuredContent!.elements as { id: string }[]).map((e) => e.id)).toEqual(["shop:cart-api", "shop:cart-store"]);
  });

  it("truncates to limit and reports the total", async () => {
    const { call, text } = await connect(elementTreeWorkspace);
    const result = await call("search_elements", { query: "cart", limit: 2 });
    expect(result.structuredContent).toMatchObject({ total: 3, truncated: true });
    expect(result.structuredContent!.elements).toHaveLength(2);
    expect(text(result).split("\n")[0]).toBe('3 Elements match "cart"; showing the first 2.');
  });

  it("says so when nothing matches", async () => {
    const { call, text } = await connect(elementTreeWorkspace);
    const result = await call("search_elements", { query: "ledger" });
    expect(result.structuredContent).toEqual({ query: "ledger", total: 0, truncated: false, elements: [] });
    expect(text(result)).toBe('No Elements match "ledger".');
  });

  it("links each match to the viewer when configured", async () => {
    const { call } = await connect(elementTreeWorkspace, { viewerUrl: "https://arch.example.com" });
    const result = await call("search_elements", { query: "cart-api" });
    expect(result.structuredContent!.elements).toEqual([expect.objectContaining({ viewerUrl: "https://arch.example.com/#/element/shop:cart-api" })]);
  });
});

describe("list_teams", () => {
  it("lists every Team with how many Elements it owns", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("list_teams");
    expect(result.structuredContent).toEqual({
      total: 2,
      truncated: false,
      teams: [
        { id: "payments-team", name: "Payments", description: null, links: [], elements: 1 },
        {
          id: "storefront-team",
          name: "Storefront",
          description: "Owns the online shop.",
          links: [{ label: "Handbook", url: "https://wiki.example.com/storefront" }],
          elements: 3,
        },
      ],
    });
    expect(text(result)).toBe(
      ["2 Teams.", "- payments-team (Payments): owns 1 Element", "- storefront-team (Storefront): owns 3 Elements; Owns the online shop."].join("\n"),
    );
  });

  it("truncates to limit and reports the total", async () => {
    const { call } = await connect(validWorkspace);
    const result = await call("list_teams", { limit: 1 });
    expect(result.structuredContent).toMatchObject({ total: 2, truncated: true, teams: [{ id: "payments-team" }] });
  });
});

describe("list_environments", () => {
  it("lists every Environment", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("list_environments");
    expect(result.structuredContent).toEqual({
      total: 2,
      truncated: false,
      environments: [
        { id: "prod", name: "Production", description: null },
        { id: "staging", name: "Staging", description: null },
      ],
    });
    expect(text(result)).toBe(["2 Environments.", "- prod (Production)", "- staging (Staging)"].join("\n"));
  });

  it("truncates to limit and reports the total", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("list_environments", { limit: 1 });
    expect(result.structuredContent).toMatchObject({ total: 2, truncated: true, environments: [{ id: "prod" }] });
    expect(text(result).split("\n")[0]).toBe("2 Environments; showing the first 1.");
  });
});

describe("tool surface", () => {
  it("lists the read tools with input and output schemas", async () => {
    const { client } = await connect(validWorkspace);
    const tools = (await client.listTools()).tools.filter((t) => t.annotations?.readOnlyHint);
    expect(tools.map((t) => t.name).sort()).toEqual([
      "find_paths",
      "get_adr",
      "get_authoring_guide",
      "get_changes",
      "get_deployments",
      "get_element",
      "get_guide",
      "get_impact",
      "get_view",
      "get_workspace_info",
      "list_adrs",
      "list_environments",
      "list_history",
      "list_owned",
      "list_teams",
      "list_views",
      "search_elements",
    ]);
    for (const t of tools) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true });
      expect(t.outputSchema).toMatchObject({ type: "object" });
    }
    const getElement = tools.find((t) => t.name === "get_element")!;
    expect(getElement.inputSchema).toMatchObject({ type: "object", properties: { id: { type: "string" } }, required: ["id"] });
    const search = tools.find((t) => t.name === "search_elements")!;
    expect(search.inputSchema.properties).toMatchObject({ limit: { type: "integer", minimum: 1, default: 50 } });
  });

  it("gives invalid_input for arguments that break a tool's schema", async () => {
    const { call } = await connect(validWorkspace);
    const missing = await call("get_element", {});
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent).toMatchObject({ code: "invalid_input", message: expect.stringContaining("id") });

    const badLimit = await call("list_teams", { limit: 0 });
    expect(badLimit.structuredContent).toMatchObject({ code: "invalid_input", message: expect.stringContaining("limit") });
  });

  it("answers a malformed call with a protocol error", async () => {
    const { client } = await connect(validWorkspace);
    await expect(client.callTool({ name: "get_elements", arguments: {} })).rejects.toMatchObject({ code: -32602 });
    await expect(client.callTool({ name: "get_element", arguments: "shop:web" as never })).rejects.toMatchObject({ code: -32602 });
  });

  it("gives source_unavailable when the checkout can no longer be read", async () => {
    const { call, root } = await connect(validWorkspace);
    await rm(root, { recursive: true });
    const result = await call("list_teams");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "source_unavailable" });
  });
});
