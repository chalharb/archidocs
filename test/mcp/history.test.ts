import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleSource, checkoutSource } from "../../src/mcp/index.ts";
import { bundleText, serveBundleSite } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";
import { connectTo } from "../support/mcp.ts";

/** v2 renames shop:web and adds shop:search; v3 hands payments:stripe to payments-team. */
const v1 = inWorkspace(validWorkspace);
const v2 = {
  "archidocs/shop/services.yaml": validWorkspace["shop/services.yaml"]!.replace("name: Web", "name: Web shop") + "  search:\n    name: Search\n",
};
const v3 = {
  "archidocs/payments/model/api.yaml": validWorkspace["payments/model/api.yaml"]!.replace("owner: storefront-team", "owner: payments-team"),
};

/** A checkout with three Revisions in January, February and March 2026; `v1` tags the first. */
async function checkout() {
  const repo = await scriptedRepo();
  const first = await repo.commit("First model", "2026-01-10T12:00:00Z", v1);
  const second = await repo.commit("Add search", "2026-02-10T12:00:00Z", v2);
  const third = await repo.commit("Stripe to payments", "2026-03-10T12:00:00Z", v3);
  repo.git("tag", "v1", first);
  return { repo, first, second, third, ...(await connectTo(checkoutSource({ root: join(repo.repoRoot, "archidocs") }))) };
}

describe("`at` on a checkout", () => {
  it("answers a read tool from the Bundle at a ref, a sha or a date", async () => {
    const { call, first, second } = await checkout();
    expect((await call("get_element", { id: "shop:web" })).structuredContent).toMatchObject({ element: { name: "Web shop" } });
    expect((await call("get_element", { id: "shop:web", at: "v1" })).structuredContent).toMatchObject({ element: { name: "Web" } });
    expect((await call("get_workspace_info", { at: second })).structuredContent).toMatchObject({ commit: second, counts: { elements: 5 } });
    expect((await call("get_workspace_info", { at: "2026-01-31" })).structuredContent).toMatchObject({ commit: first, counts: { elements: 4 } });
  });
});

describe("`at` on a checkout's edges", () => {
  it("rebuilds a cached Bundle from an older schema rather than reading it", async () => {
    const { repo, call, first } = await checkout();
    const cached = join(repo.repoRoot, ".archidocs", "cache", "bundles", `${first}.json`);
    await mkdir(dirname(cached), { recursive: true });
    await writeFile(cached, JSON.stringify({ ...JSON.parse(await bundleText(validWorkspace, first)), schemaVersion: 0, elements: [] }));
    expect((await call("get_workspace_info", { at: "v1" })).structuredContent).toMatchObject({ commit: first, counts: { elements: 4 } });
  });

  it("returns history_unavailable outside git", async () => {
    const root = await mkdtemp(join(tmpdir(), "archidocs-nogit-"));
    for (const [path, text] of Object.entries(validWorkspace)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }
    const { call } = await connectTo(checkoutSource({ root }));
    expect((await call("list_teams", { at: "HEAD" })).structuredContent).toMatchObject({ code: "history_unavailable" });
    expect((await call("list_history")).structuredContent).toMatchObject({ code: "history_unavailable" });
  });
});

describe("`at` and the other tools", () => {
  it("is refused by every write tool, with the Workspace left as it is", async () => {
    const { call } = await checkout();
    for (const [name, args] of [
      ["upsert_element", { project: "shop", kind: "service", id: "mail", fields: { name: "Mail" } }],
      ["remove_element", { project: "shop", id: "web" }],
      ["check", {}],
    ] as const) {
      const result = await call(name, { ...args, at: "v1" });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent, name).toMatchObject({ code: "invalid_input", message: expect.stringContaining("never take `at`") });
    }
    expect((await call("get_element", { id: "shop:web" })).structuredContent).toMatchObject({ element: { name: "Web shop" } });
  });

  it("is advertised on every read tool and on no write tool", async () => {
    const { client } = await checkout();
    const { tools } = await client.listTools();
    for (const t of tools) {
      const properties = (t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect("at" in properties, t.name).toBe(t.annotations?.readOnlyHint === true);
    }
  });

  it("reports a point that names no commit as not_found", async () => {
    const { call } = await checkout();
    expect((await call("list_teams", { at: "no-such-tag" })).structuredContent).toMatchObject({ code: "not_found" });
    expect((await call("list_teams", { at: "1999-01-01" })).structuredContent).toMatchObject({ code: "not_found" });
  });
});

const summarise = (changes: unknown) => (changes as { type: string; kind: string; id: string; fields: string[] }[]).map((c) => [c.type, c.id, c.fields]);

describe("get_changes", () => {
  it("lists the Changes from a point to the current Workspace, with both commits and counts per kind", async () => {
    const { call, text, first, third } = await checkout();
    const result = await call("get_changes", { from: "v1" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      from: { point: "v1", commit: first },
      to: { point: null, commit: third },
      total: 3,
      truncated: false,
      counts: { element: { added: 1, removed: 0, changed: 2 } },
    });
    expect(summarise(result.structuredContent!.changes)).toEqual([
      ["changed", "payments:stripe", ["owner"]],
      ["added", "shop:search", []],
      ["changed", "shop:web", ["name"]],
    ]);
    expect((result.structuredContent!.changes as { before: unknown; after: unknown }[])[2]).toMatchObject({ before: { name: "Web" }, after: { name: "Web shop" } });
    expect(text(result)).toContain("3 Changes from v1");
    expect(text(result)).toContain("~ element shop:web: name");
  });

  it("compares two given points, or up to `at`", async () => {
    const { call, second } = await checkout();
    const between = await call("get_changes", { from: "2026-01-31", to: second });
    expect(summarise(between.structuredContent!.changes)).toEqual([
      ["added", "shop:search", []],
      ["changed", "shop:web", ["name"]],
    ]);
    expect((await call("get_changes", { from: "v1", at: "2026-02-28" })).structuredContent).toMatchObject({ to: { point: "2026-02-28", commit: second }, total: 2 });
  });

  it("narrows to an Element and its descendants, a Team's items at either side, a Project, or some kinds", async () => {
    const { call } = await checkout();
    const ids = async (args: Record<string, unknown>) => summarise((await call("get_changes", { from: "v1", ...args })).structuredContent!.changes).map(([, id]) => id);
    expect(await ids({ scope: "shop:web" })).toEqual(["shop:web"]);
    expect(await ids({ scope: "payments-team" })).toEqual(["payments:stripe"]);
    expect(await ids({ scope: "storefront-team" })).toEqual(["payments:stripe", "shop:search", "shop:web"]);
    expect(await ids({ scope: "shop" })).toEqual(["shop:search", "shop:web"]);
    expect(await ids({ kinds: ["team", "relationship"] })).toEqual([]);
    expect((await call("get_changes", { from: "v1", scope: "shop:nope" })).structuredContent).toMatchObject({ code: "not_found" });
  });

  it("cuts the list at `limit` and says so", async () => {
    const { call } = await checkout();
    expect((await call("get_changes", { from: "v1", limit: 1 })).structuredContent).toMatchObject({ total: 3, truncated: true, changes: [{ id: "payments:stripe" }] });
  });
});

const shas = (result: { structuredContent?: Record<string, unknown> }) => (result.structuredContent!.revisions as { sha: string }[]).map((r) => r.sha);

describe("list_history on a checkout", () => {
  it("lists the Revisions newest first, with their tags and change counts", async () => {
    const { call, text, first, second, third } = await checkout();
    const result = await call("list_history");
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ total: 3, truncated: false });
    expect(shas(result)).toEqual([third, second, first]);
    expect((result.structuredContent!.revisions as unknown[])[2]).toEqual({
      sha: first,
      date: "2026-01-10T12:00:00Z",
      subject: "First model",
      author: "Ana Author",
      tags: ["v1"],
      counts: { added: 10, removed: 0, changed: 0 },
      bundle: true,
    });
    expect(text(result)).toContain(`- ${second.slice(0, 7)} 2026-02-10 Add search (Ana Author): +1 ~1`);
  });

  it("narrows to the Revisions that touched a scope, between two points, up to `at`", async () => {
    const { call, first, second, third } = await checkout();
    expect(shas(await call("list_history", { scope: "shop:web" }))).toEqual([second, first]);
    expect(shas(await call("list_history", { scope: "payments-team" }))).toEqual([third, first]);
    expect(shas(await call("list_history", { since: "2026-02-01" }))).toEqual([third, second]);
    expect(shas(await call("list_history", { until: "2026-02-10" }))).toEqual([second, first]);
    expect(shas(await call("list_history", { since: "v1", until: second }))).toEqual([second, first]);
    expect(shas(await call("list_history", { at: "v1" }))).toEqual([first]);
    expect((await call("list_history", { limit: 1 })).structuredContent).toMatchObject({ total: 3, truncated: true });
  });
});

const sha = (c: string) => c.repeat(40);
const [NOW, MISSING, OLD, V2, DROPPED] = [sha("c"), sha("d"), sha("e"), sha("b"), sha("a")];
const entry = (s: string, date: string, changedIds: string[], extra: { tags?: string[]; bundle?: boolean } = {}) => ({
  sha: s,
  date,
  subject: `Revision ${s.slice(0, 1)}`,
  author: "Ana Author",
  tags: extra.tags ?? [],
  counts: { added: 0, removed: 0, changed: changedIds.length },
  changedIds,
  bundle: extra.bundle ?? true,
});

/**
 * A published site: the current Bundle (shop:web is "Web shop") and the
 * Revision index, whose changed ids are made up so a test can tell they were
 * read rather than diffed. `v2`'s Bundle has shop:web as "Web"; one Bundle is
 * missing, one has a schema with no migration, and the oldest was dropped.
 */
async function siteFiles(withIndex = true) {
  const current = await bundleText({ ...validWorkspace, "shop/services.yaml": v2["archidocs/shop/services.yaml"]! }, NOW);
  const old = JSON.stringify({ ...JSON.parse(await bundleText(validWorkspace, OLD)), schemaVersion: 0 });
  const index = {
    schemaVersion: 1,
    revisions: [
      entry(NOW, "2026-04-10T12:00:00Z", ["shop:search", "shop:web"]),
      entry(MISSING, "2026-03-10T12:00:00Z", ["payments:stripe"]),
      entry(OLD, "2026-02-15T12:00:00Z", ["payments:payments-api"]),
      entry(V2, "2026-02-10T12:00:00Z", ["shop:imaginary"], { tags: ["v2"] }),
      entry(DROPPED, "2026-01-10T12:00:00Z", ["shop:web", "payments:stripe"], { bundle: false }),
    ],
  };
  const files: Record<string, string> = { [`bundles/${OLD}.json`]: old, [`bundles/${V2}.json`]: await bundleText(validWorkspace, V2) };
  if (withIndex) files["bundles/index.json"] = JSON.stringify(index);
  return { current, files };
}

async function site(withIndex = true) {
  const { current, files } = await siteFiles(withIndex);
  const served = await serveBundleSite(current, { files });
  return connectTo(bundleSource({ location: served.url }));
}

describe("history from a published Bundle site", () => {
  it("answers `at` from bundles/<sha>.json, found by tag, date or sha", async () => {
    const { call } = await site();
    expect((await call("get_element", { id: "shop:web" })).structuredContent).toMatchObject({ element: { name: "Web shop" } });
    expect((await call("get_element", { id: "shop:web", at: "v2" })).structuredContent).toMatchObject({ element: { name: "Web" } });
    expect((await call("get_workspace_info", { at: "2026-02-12" })).structuredContent).toMatchObject({ commit: V2 });
    expect((await call("get_workspace_info", { at: "bbbbbbb" })).structuredContent).toMatchObject({ commit: V2 });
    expect((await call("get_workspace_info", { at: NOW })).structuredContent).toMatchObject({ commit: NOW });
  });

  it("returns history_unavailable for a dropped, missing or unreadable Bundle", async () => {
    const { call, text } = await site();
    for (const at of ["2026-01-31", MISSING, OLD]) {
      const result = await call("list_teams", { at });
      expect(result.isError, at).toBe(true);
      expect(result.structuredContent, at).toMatchObject({ code: "history_unavailable" });
    }
    expect(text(await call("list_teams", { at: DROPPED }))).toContain("was not kept");
    expect((await call("list_teams", { at: "v9" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["v2"] });
  });

  it("diffs two Bundles it can read, and refuses one it can't", async () => {
    const { call } = await site();
    const result = await call("get_changes", { from: "v2" });
    expect(result.structuredContent).toMatchObject({ from: { point: "v2", commit: V2 }, to: { commit: NOW }, total: 2 });
    expect(summarise(result.structuredContent!.changes)).toEqual([
      ["added", "shop:search", []],
      ["changed", "shop:web", ["name"]],
    ]);
    expect((await call("get_changes", { from: DROPPED })).structuredContent).toMatchObject({ code: "history_unavailable" });
  });

  it("lists history from the index's changed ids alone, never diffing Bundles", async () => {
    const { call } = await site();
    const all = await call("list_history");
    expect(shas(all)).toEqual([NOW, MISSING, OLD, V2, DROPPED]);
    expect((all.structuredContent!.revisions as { bundle: boolean }[]).map((r) => r.bundle)).toEqual([true, true, true, true, false]);
    // Only the index says v2 touched shop:imaginary; no Bundle holds it.
    expect(shas(await call("list_history", { scope: "shop:imaginary" }))).toEqual([V2]);
    expect(shas(await call("list_history", { scope: "shop:web" }))).toEqual([NOW, DROPPED]);
    expect(shas(await call("list_history", { scope: "payments", since: "v2", until: "2026-03-31" }))).toEqual([MISSING, OLD]);
  });

  it("returns history_unavailable when the site publishes no index, yet answers at its own commit", async () => {
    const { call } = await site(false);
    expect((await call("list_history")).structuredContent).toMatchObject({ code: "history_unavailable" });
    expect((await call("get_element", { id: "shop:web", at: "v2" })).structuredContent).toMatchObject({ code: "history_unavailable" });
    expect((await call("get_workspace_info", { at: NOW.slice(0, 7) })).structuredContent).toMatchObject({ commit: NOW });
  });

  it("reads a site folder on disk the same way", async () => {
    const { current, files } = await siteFiles();
    const dir = await mkdtemp(join(tmpdir(), "archidocs-site-"));
    for (const [path, text] of Object.entries({ "workspace.bundle.json": current, ...files })) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    const { call } = await connectTo(bundleSource({ location: dir }));
    expect((await call("get_element", { id: "shop:web", at: "v2" })).structuredContent).toMatchObject({ element: { name: "Web" } });
    expect((await call("list_teams", { at: DROPPED })).structuredContent).toMatchObject({ code: "history_unavailable" });
  });
});
