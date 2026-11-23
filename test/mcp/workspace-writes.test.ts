import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Files } from "../support/workspace.ts";
import { connect, connectTo } from "../support/mcp.ts";
import { bundleSource } from "../../src/mcp/index.ts";
import { bundleText, serveBundleSite } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";

/** A commented Workspace: the comments in workspace.yaml must survive every write. */
const workspace: Files = {
  "workspace.yaml": `# Who owns what.
teams:
  shop-team:
    name: Shop # the storefront people
# Where things run.
environments:
  prod:
    name: Production
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: shop-team
`,
  "shop/model.yaml": `services:
  web:
    name: Web
`,
};

async function setup(files: Files = workspace) {
  const session = await connect(files);
  const read = (path: string) => readFile(join(session.root, path), "utf8");
  const exists = (path: string) => read(path).then(() => true, () => false);
  return { ...session, read, exists };
}

describe("upsert_team", () => {
  it("adds a Team to workspace.yaml and updates an existing one, keeping comments", async () => {
    const { call, read } = await setup();
    const added = await call("upsert_team", { id: "payments-team", fields: { name: "Payments", description: "Takes the money." } });
    expect(added.isError).toBeFalsy();
    expect(added.structuredContent).toMatchObject({ action: "created", id: "payments-team", files: ["archidocs/workspace.yaml"] });
    const updated = await call("upsert_team", { id: "shop-team", fields: { description: "Runs the storefront." } });
    expect(updated.structuredContent).toMatchObject({ action: "updated", id: "shop-team" });
    expect(await read("workspace.yaml")).toBe(`# Who owns what.
teams:
  shop-team:
    name: Shop # the storefront people
    description: Runs the storefront.
  payments-team:
    name: Payments
    description: Takes the money.
# Where things run.
environments:
  prod:
    name: Production
`);
  });

  it("refuses a new Team with no name, writing nothing", async () => {
    const { call, read } = await setup();
    const result = await call("upsert_team", { id: "ops", fields: { description: "No name." } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", issues: [expect.objectContaining({ file: "archidocs/workspace.yaml", severity: "error" })] });
    expect(await read("workspace.yaml")).toBe(workspace["workspace.yaml"]);
  });
});

describe("upsert_environment", () => {
  it("adds an Environment to workspace.yaml, keeping comments, and returns only the diff on dry_run", async () => {
    const { call, read } = await setup();
    const dry = await call("upsert_environment", { id: "staging", fields: { name: "Staging" }, dry_run: true });
    expect(dry.structuredContent).toMatchObject({ action: "created", id: "staging", dryRun: true });
    expect(dry.structuredContent!.diff).toContain("+  staging:\n+    name: Staging\n");
    expect(await read("workspace.yaml")).toBe(workspace["workspace.yaml"]);

    await call("upsert_environment", { id: "staging", fields: { name: "Staging" } });
    expect(await read("workspace.yaml")).toBe(`# Who owns what.
teams:
  shop-team:
    name: Shop # the storefront people
# Where things run.
environments:
  prod:
    name: Production
  staging:
    name: Staging
`);
  });
});

describe("create_project", () => {
  it("writes project.yaml into <workspace-root>/<id>/ by default, or into folder", async () => {
    const { call, read } = await setup();
    const result = await call("create_project", { id: "search", name: "Search", owner: "shop-team" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ action: "created", id: "search", files: ["archidocs/search/project.yaml"] });
    expect(result.structuredContent!.diff).toBe(`--- /dev/null
+++ b/archidocs/search/project.yaml
@@ -0,0 +1,3 @@
+id: search
+name: Search
+owner: shop-team
`);
    expect(await read("search/project.yaml")).toBe("id: search\nname: Search\nowner: shop-team\n");

    await call("create_project", { id: "ledger", name: "Ledger", owner: "shop-team", folder: "finance/ledger" });
    expect(await read("finance/ledger/project.yaml")).toBe("id: ledger\nname: Ledger\nowner: shop-team\n");
    expect((await call("get_workspace_info")).structuredContent).toMatchObject({ counts: { projects: 3 }, issues: { errors: 0 } });
  });

  it("refuses an id already in use, with the existing Project", async () => {
    const { call, exists } = await setup();
    const result = await call("create_project", { id: "shop", name: "Shop again", owner: "shop-team", folder: "shop2" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", references: [{ file: "archidocs/shop/project.yaml", line: 1 }] });
    expect(await exists("shop2/project.yaml")).toBe(false);
  });

  it("refuses a folder inside an existing Project, or holding one", async () => {
    const { call, exists } = await setup();
    const inside = await call("create_project", { id: "basket", name: "Basket", owner: "shop-team", folder: "shop/basket" });
    expect(inside.isError).toBe(true);
    expect(inside.structuredContent).toMatchObject({ code: "validation_failed", references: [{ file: "archidocs/shop/project.yaml", line: 1, what: expect.stringContaining("would contain it") }] });
    expect(await exists("shop/basket/project.yaml")).toBe(false);

    const around = await call("create_project", { id: "everything", name: "Everything", owner: "shop-team", folder: "." });
    expect(around.structuredContent).toMatchObject({ code: "invalid_input" });
    const escape = await call("create_project", { id: "outside", name: "Outside", owner: "shop-team", folder: "../outside" });
    expect(escape.structuredContent).toMatchObject({ code: "invalid_input" });
  });

  it("refuses an unknown owner with the issue", async () => {
    const { call, exists } = await setup();
    const result = await call("create_project", { id: "search", name: "Search", owner: "nobody" });
    expect(result.structuredContent).toMatchObject({ code: "validation_failed", issues: [expect.objectContaining({ rule: "unknown-team", file: "archidocs/search/project.yaml" })] });
    expect(await exists("search/project.yaml")).toBe(false);
  });
});

describe("remaining write tools when writes are off", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["upsert_target", { project: "shop", id: "eu", fields: { name: "EU", kind: "region" } }],
    ["remove_target", { project: "shop", id: "eu" }],
    ["upsert_deployment", { project: "shop", service: "web", environment: "prod", target: "eu" }],
    ["remove_deployment", { project: "shop", service: "web", environment: "prod", target: "eu" }],
    ["upsert_team", { id: "ops", fields: { name: "Ops" } }],
    ["upsert_environment", { id: "dev", fields: { name: "Dev" } }],
    ["create_project", { id: "search", name: "Search", owner: "shop-team" }],
  ];

  it("return read_only from a Bundle source and over HTTP without --allow-writes", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, "c".repeat(40)));
    const { call } = await connectTo(bundleSource({ location: site.url }));
    const { call: callHttp, root } = await connect(workspace, { allowWrites: false });
    for (const [name, args] of calls) {
      expect((await call(name, args)).structuredContent, name).toMatchObject({ code: "read_only", message: expect.stringContaining("published Bundle") });
      expect((await callHttp(name, args)).structuredContent, name).toMatchObject({ code: "read_only", message: expect.stringContaining("--allow-writes") });
    }
    expect(await readFile(join(root, "workspace.yaml"), "utf8")).toBe(workspace["workspace.yaml"]);
  });
});
