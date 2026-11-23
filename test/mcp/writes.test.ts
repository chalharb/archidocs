import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Files } from "../support/workspace.ts";
import { connect, connectTo } from "../support/mcp.ts";
import { bundleSource } from "../../src/mcp/index.ts";
import { bundleText, serveBundleSite } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";

/** A commented Workspace for write tests: the comments and key order must survive every write. */
const commented: Files = {
  "workspace.yaml": `teams:
  storefront-team:
    name: Storefront
  payments-team:
    name: Payments
environments:
  prod:
    name: Production
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: storefront-team
`,
  "shop/systems.yaml": `# The checkout System and what it runs.
systems:
  checkout:
    name: Checkout # shown on C1
    services:
      # Holds the cart between visits.
      cart:
        name: Cart
        technology: Go
        tags: [core]
        relationships:
          - to: cart-db
            description: Reads and writes carts
      cart-db:
        name: Cart DB
        type: datastore
`,
  "shop/web.yaml": `services:
  web:
    name: Web
    relationships:
      # Both are calls to the cart API.
      - to: cart
        description: Adds items
      - to: cart
        description: Reads the cart
`,
  "payments/project.yaml": `id: payments
name: Payments
owner: payments-team
`,
  "payments/model.yaml": `services:
  charges:
    name: Charges
deployments:
  - { service: charges, environment: prod, target: eu }
targets:
  eu:
    name: EU
    kind: region
`,
};

async function setup(files: Files = commented) {
  const session = await connect(files);
  const read = (path: string) => readFile(join(session.root, path), "utf8");
  return { ...session, read };
}

describe("upsert_element", () => {
  it("updates an existing Element in place, keeping comments and key order", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_element", {
      project: "shop",
      kind: "service",
      id: "cart",
      fields: { description: "Keeps the shopper's cart.", technology: "Rust" },
    });
    expect(result.isError).toBeFalsy();
    expect(await read("shop/systems.yaml")).toBe(`# The checkout System and what it runs.
systems:
  checkout:
    name: Checkout # shown on C1
    services:
      # Holds the cart between visits.
      cart:
        name: Cart
        technology: Rust
        tags: [core]
        relationships:
          - to: cart-db
            description: Reads and writes carts
        description: Keeps the shopper's cart.
      cart-db:
        name: Cart DB
        type: datastore
`);
    expect(result.structuredContent).toMatchObject({ action: "updated", id: "shop:cart", dryRun: false, files: ["archidocs/shop/systems.yaml"] });
    expect(result.structuredContent!.diff).toBe(`--- a/archidocs/shop/systems.yaml
+++ b/archidocs/shop/systems.yaml
@@ -6,11 +6,12 @@
       # Holds the cart between visits.
       cart:
         name: Cart
-        technology: Go
+        technology: Rust
         tags: [core]
         relationships:
           - to: cart-db
             description: Reads and writes carts
+        description: Keeps the shopper's cart.
       cart-db:
         name: Cart DB
         type: datastore
`);
  });

  it("puts a new Element into its parent's file, under its parent", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_element", { project: "shop", kind: "component", id: "cart-api", parent: "cart", fields: { name: "Cart API" } });
    expect(result.structuredContent).toMatchObject({ action: "created", id: "shop:cart-api", files: ["archidocs/shop/systems.yaml"] });
    expect(await read("shop/systems.yaml")).toBe(`# The checkout System and what it runs.
systems:
  checkout:
    name: Checkout # shown on C1
    services:
      # Holds the cart between visits.
      cart:
        name: Cart
        technology: Go
        tags: [core]
        relationships:
          - to: cart-db
            description: Reads and writes carts
        components:
          cart-api:
            name: Cart API
      cart-db:
        name: Cart DB
        type: datastore
`);
  });

  it("puts a new Element with a parent and a file top-level in that file, attached with in:", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_element", { project: "shop", kind: "component", id: "cart-api", parent: "shop:cart", file: "cart/api.yaml", fields: { name: "Cart API", technology: "Go" } });
    expect(result.structuredContent).toMatchObject({ action: "created", files: ["archidocs/shop/cart/api.yaml"] });
    expect(await read("shop/cart/api.yaml")).toBe(`components:
  cart-api:
    name: Cart API
    in: cart
    technology: Go
`);
    expect(result.structuredContent!.diff).toBe(`--- /dev/null
+++ b/archidocs/shop/cart/api.yaml
@@ -0,0 +1,5 @@
+components:
+  cart-api:
+    name: Cart API
+    in: cart
+    technology: Go
`);
  });

  it("puts a new top-level Element into the named file, else the Project's model.yaml", async () => {
    const { call, read } = await setup();
    await call("upsert_element", { project: "shop", kind: "person", id: "shopper", fields: { name: "Shopper" } });
    expect(await read("shop/model.yaml")).toBe("people:\n  shopper:\n    name: Shopper\n");

    await call("upsert_element", { project: "shop", kind: "service", id: "search", file: "web.yaml", fields: { name: "Search", tags: ["frontend"] } });
    expect(await read("shop/web.yaml")).toBe(`services:
  web:
    name: Web
    relationships:
      # Both are calls to the cart API.
      - to: cart
        description: Adds items
      - to: cart
        description: Reads the cart
  search:
    name: Search
    tags:
      - frontend
`);
  });
});

describe("formatting", () => {
  it("keeps a file's own indent, sequence style, quoting, flow padding and long lines", async () => {
    const styled = `# Styled by hand.
services:
    web:
        name: "Web"
        description: 'A long description that runs well past eighty characters and must not be folded onto a second line.'
        tags: [ frontend, edge ]
        links:
            - label: Docs
              url: https://docs.example.com/web
`;
    const flush = `services:
  api:
    name: API
    links:
    - label: Docs
      url: https://docs.example.com/api
`;
    const { call, read } = await setup({ ...commented, "shop/web.yaml": styled, "shop/api.yaml": flush });
    await call("upsert_element", { project: "shop", kind: "service", id: "web", fields: { technology: "Next.js" } });
    expect(await read("shop/web.yaml")).toBe(styled + "        technology: Next.js\n");
    await call("upsert_element", { project: "shop", kind: "service", id: "api", fields: { technology: "Go" } });
    expect(await read("shop/api.yaml")).toBe(flush + "    technology: Go\n");
  });
});

describe("every write", () => {
  it("refuses a write that would introduce an error, leaving the files unchanged and returning the issues", async () => {
    const { call, read } = await setup();
    const before = await read("shop/systems.yaml");
    const result = await call("upsert_element", { project: "shop", kind: "service", id: "cart", fields: { owner: "no-such-team" } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "validation_failed",
      issues: [{ file: "archidocs/shop/systems.yaml", line: 14, rule: "unknown-team", severity: "error" }],
    });
    expect(await read("shop/systems.yaml")).toBe(before);
  });

  it("refuses a new Element with no name, and writes no new file", async () => {
    const { call, root } = await setup();
    const result = await call("upsert_element", { project: "shop", kind: "person", id: "shopper", fields: {} });
    expect(result.structuredContent).toMatchObject({ code: "validation_failed" });
    await expect(readFile(join(root, "shop/model.yaml"), "utf8")).rejects.toThrow();
  });

  it("returns the diff and writes nothing on dry_run", async () => {
    const { call, read, text } = await setup();
    const before = await read("shop/systems.yaml");
    const result = await call("upsert_element", { project: "shop", kind: "service", id: "cart", fields: { technology: "Rust" }, dry_run: true });
    expect(result.structuredContent).toMatchObject({ action: "updated", dryRun: true, files: ["archidocs/shop/systems.yaml"] });
    expect(result.structuredContent!.diff).toContain("-        technology: Go\n+        technology: Rust\n");
    expect(text(result)).toContain("would be updated");
    expect(await read("shop/systems.yaml")).toBe(before);
  });

  it("reports an unknown Project or parent as not_found with suggestions", async () => {
    const { call } = await setup();
    expect((await call("upsert_element", { project: "shopp", kind: "person", id: "x", fields: { name: "X" } })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop"] });
    expect((await call("upsert_element", { project: "shop", kind: "component", id: "x", parent: "carts", fields: { name: "X" } })).structuredContent).toMatchObject({
      code: "not_found",
      suggestions: ["shop:cart"],
    });
  });
});

describe("upsert_relationship", () => {
  it("adds a Relationship under its consumer, keeping the comments around it", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_relationship", { project: "shop", from: "cart", to: "payments:charges", fields: { description: "Charges the card", technology: "gRPC" } });
    expect(result.structuredContent).toMatchObject({ action: "created", from: "shop:cart", to: "payments:charges", id: null });
    expect(await read("shop/systems.yaml")).toBe(`# The checkout System and what it runs.
systems:
  checkout:
    name: Checkout # shown on C1
    services:
      # Holds the cart between visits.
      cart:
        name: Cart
        technology: Go
        tags: [core]
        relationships:
          - to: cart-db
            description: Reads and writes carts
          - to: payments:charges
            description: Charges the card
            technology: gRPC
      cart-db:
        name: Cart DB
        type: datastore
`);
  });

  it("updates the one Relationship on a pair", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_relationship", { project: "shop", from: "shop:cart", to: "cart-db", fields: { technology: "SQL", description: null } });
    expect(result.structuredContent).toMatchObject({ action: "updated", to: "shop:cart-db" });
    expect(await read("shop/systems.yaml")).toContain(`        relationships:
          - to: cart-db
            technology: SQL
      cart-db:`);
  });

  it("returns ambiguous with each candidate's file:line when several are on the pair and no id is given", async () => {
    const { call, read, text } = await setup();
    const before = await read("shop/web.yaml");
    const result = await call("upsert_relationship", { project: "shop", from: "web", to: "cart", fields: { technology: "HTTPS" } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "ambiguous",
      candidates: [
        { file: "archidocs/shop/web.yaml", line: 6 },
        { file: "archidocs/shop/web.yaml", line: 8 },
      ],
    });
    expect(text(result)).toContain("archidocs/shop/web.yaml:6");
    expect(await read("shop/web.yaml")).toBe(before);
  });

  it("matches by id when one is given, and adds a new one with that id otherwise", async () => {
    const files = { ...commented, "shop/web.yaml": commented["shop/web.yaml"]!.replace("      - to: cart\n        description: Adds items", "      - to: cart\n        id: add-item\n        description: Adds items") };
    const { call, read } = await setup(files);
    expect((await call("upsert_relationship", { project: "shop", from: "web", to: "cart", id: "add-item", fields: { technology: "HTTPS" } })).structuredContent).toMatchObject({ action: "updated", id: "shop:add-item" });
    expect((await call("upsert_relationship", { project: "shop", from: "web", to: "cart", id: "checkout", fields: { description: "Checks out" } })).structuredContent).toMatchObject({ action: "created", id: "shop:checkout" });
    expect(await read("shop/web.yaml")).toBe(`services:
  web:
    name: Web
    relationships:
      # Both are calls to the cart API.
      - to: cart
        id: add-item
        description: Adds items
        technology: HTTPS
      - to: cart
        description: Reads the cart
      - to: cart
        id: checkout
        description: Checks out
`);
  });

  it("refuses a Relationship to an unknown Element", async () => {
    const { call } = await setup();
    const result = await call("upsert_relationship", { project: "shop", from: "cart", to: "nowhere", fields: {} });
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", issues: [{ rule: "unknown-element" }] });
  });
});

describe("remove_element", () => {
  it("refuses while anything references the Element, listing each reference's file:line", async () => {
    const { call, read, text } = await setup();
    const before = await read("shop/systems.yaml");
    const result = await call("remove_element", { project: "shop", id: "checkout" });
    expect(result.structuredContent).toMatchObject({
      code: "validation_failed",
      references: [
        { file: "archidocs/shop/systems.yaml", line: 7, what: "Service shop:cart is in it" },
        { file: "archidocs/shop/systems.yaml", line: 14, what: "Service shop:cart-db is in it" },
      ],
    });
    expect(await read("shop/systems.yaml")).toBe(before);

    expect((await call("remove_element", { project: "shop", id: "cart" })).structuredContent).toMatchObject({
      references: [
        { file: "archidocs/shop/web.yaml", line: 6, what: "Relationship shop:web -> shop:cart: Adds items" },
        { file: "archidocs/shop/web.yaml", line: 8, what: "Relationship shop:web -> shop:cart: Reads the cart" },
      ],
    });
    const deployed = await call("remove_element", { project: "payments", id: "charges" });
    expect(deployed.structuredContent).toMatchObject({ references: [{ file: "archidocs/payments/model.yaml", line: 5, what: "Deployment of payments:charges to prod on payments:eu" }] });
    expect(text(deployed)).toContain("archidocs/payments/model.yaml:5");
  });

  it("removes an unreferenced Element, keeping the rest of the file as it was", async () => {
    const { call, read } = await setup();
    expect((await call("remove_relationship", { project: "shop", from: "cart", to: "cart-db" })).structuredContent).toMatchObject({ action: "removed" });
    const result = await call("remove_element", { project: "shop", id: "cart-db" });
    expect(result.structuredContent).toMatchObject({ action: "removed", id: "shop:cart-db" });
    expect(await read("shop/systems.yaml")).toBe(`# The checkout System and what it runs.
systems:
  checkout:
    name: Checkout # shown on C1
    services:
      # Holds the cart between visits.
      cart:
        name: Cart
        technology: Go
        tags: [core]
`);
  });

  it("reports an unknown Element as not_found", async () => {
    const { call } = await setup();
    expect((await call("remove_element", { project: "shop", id: "carts" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop:cart"] });
  });
});

describe("remove_relationship", () => {
  it("returns ambiguous for several on a pair, and not_found for none", async () => {
    const { call } = await setup();
    expect((await call("remove_relationship", { project: "shop", from: "web", to: "cart" })).structuredContent).toMatchObject({ code: "ambiguous", candidates: [{ line: 6 }, { line: 8 }] });
    expect((await call("remove_relationship", { project: "shop", from: "web", to: "cart-db" })).structuredContent).toMatchObject({ code: "not_found" });
  });

  it("removes one by id, keeping the comment above the list", async () => {
    const files = { ...commented, "shop/web.yaml": commented["shop/web.yaml"]!.replace("        description: Reads the cart", "        id: read-cart\n        description: Reads the cart") };
    const { call, read } = await setup(files);
    expect((await call("remove_relationship", { project: "shop", from: "web", to: "cart", id: "read-cart" })).structuredContent).toMatchObject({ action: "removed", id: "shop:read-cart" });
    expect(await read("shop/web.yaml")).toBe(`services:
  web:
    name: Web
    relationships:
      # Both are calls to the cart API.
      - to: cart
        description: Adds items
`);
  });
});

describe("write tools", () => {
  it("are listed as writes, each taking project and dry_run", async () => {
    const { client } = await setup();
    const tools = (await client.listTools()).tools.filter((t) => t.annotations?.readOnlyHint === false);
    expect(tools.map((t) => t.name).sort()).toEqual(["check", "remove_element", "remove_relationship", "upsert_element", "upsert_relationship"]);
    for (const t of tools.filter((t) => t.name !== "check")) expect(t.inputSchema.properties).toMatchObject({ project: { type: "string" }, dry_run: { type: "boolean", default: false } });
  });
});

describe("writes and git", () => {
  it("never commit or stage anything", async () => {
    const { call, repoRoot, commit } = await setup();
    await call("upsert_element", { project: "shop", kind: "person", id: "shopper", fields: { name: "Shopper" } });
    const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(git("rev-parse", "HEAD")).toBe(commit);
    expect(git("status", "--porcelain")).toBe("?? archidocs/shop/model.yaml");
  });
});

describe("check and write gating", () => {
  it("run against a checkout: check validates what is on disk", async () => {
    const { call, text, root } = await connect(validWorkspace);
    expect((await call("check")).structuredContent).toEqual({ issues: [], summary: { errors: 0, warnings: 0 } });

    await writeFile(join(root, "shop/broken.yaml"), "services:\n  cart:\n    name: Cart\n    owner: nobody\n");
    const result = await call("check");
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      issues: [{ file: "archidocs/shop/broken.yaml", line: 4, rule: "unknown-team", severity: "error" }],
      summary: { errors: 1, warnings: 0 },
    });
    expect(text(result)).toContain("1 error, 0 warnings");
  });

  it("return read_only from a Bundle source", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, "a".repeat(40)));
    const { call } = await connectTo(bundleSource({ location: site.url }));
    const result = await call("check");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ code: "read_only", message: expect.stringContaining("published Bundle") });
  });

  it("return read_only when the transport doesn't allow writes, as over HTTP without --allow-writes", async () => {
    const { call } = await connect(validWorkspace, { allowWrites: false });
    expect((await call("get_workspace_info")).structuredContent).toMatchObject({ writesAllowed: false });
    const result = await call("check");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ code: "read_only", message: expect.stringContaining("--allow-writes") });
  });

  it("are advertised as not read-only", async () => {
    const { client } = await connect(validWorkspace);
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "check")?.annotations).toMatchObject({ readOnlyHint: false });
    expect(tools.find((t) => t.name === "get_element")?.annotations).toMatchObject({ readOnlyHint: true });
  });
});

describe("Model write tools when writes are off", () => {
  it("return read_only from a Bundle source and over HTTP without --allow-writes", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, "b".repeat(40)));
    const { call } = await connectTo(bundleSource({ location: site.url }));
    const args = { project: "shop", kind: "person", id: "x", fields: { name: "X" } };
    expect((await call("upsert_element", args)).structuredContent).toMatchObject({ code: "read_only", message: expect.stringContaining("published Bundle") });

    const { call: callHttp, root } = await connect(commented, { allowWrites: false });
    expect((await callHttp("upsert_element", { ...args, project: "shop" })).structuredContent).toMatchObject({ code: "read_only", message: expect.stringContaining("--allow-writes") });
    await expect(readFile(join(root, "shop/model.yaml"), "utf8")).rejects.toThrow();
  });
});
