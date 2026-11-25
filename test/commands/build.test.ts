import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build, type BuildOptions } from "../../src/commands/index.ts";
import { landscapeWorkspace, validWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";
import { checkoutAt } from "../../src/workspace/index.ts";
import { brokenWorkspace, checkoutOf, checkoutOutsideGit, VIEWER_DIR } from "./support.ts";

const options = (out: string, more: Partial<BuildOptions> = {}): BuildOptions => ({ out, viewerDir: VIEWER_DIR, keep: 10, bundleOnly: false, ...more });
const tempOut = async () => join(await mkdtemp(join(tmpdir(), "archidocs-out-")), "site");

describe("build", () => {
  it("returns the issues and writes nothing when the Workspace has errors", async () => {
    const { checkout } = await checkoutOf(brokenWorkspace);
    const out = await tempOut();

    const result = await build(checkout, options(out));

    expect(result.kind).toBe("errors");
    expect(result.kind === "errors" && result.issues.map((i) => i.rule)).toEqual(["unknown-team", "unknown-field"]);
    expect(existsSync(out)).toBe(false);
  });

  it("writes the Bundle alone", async () => {
    const { checkout } = await checkoutOf(validWorkspace);
    const out = await tempOut();

    const result = await build(checkout, options(out, { bundleOnly: true }));

    expect(result).toEqual({ kind: "bundle", file: join(out, "workspace.bundle.json") });
    expect(await readdir(out)).toEqual(["workspace.bundle.json"]);
  });

  it("writes a site with the viewer, site.json and an empty Revision index outside git", async () => {
    const { checkout } = await checkoutOutsideGit(validWorkspace);
    const out = await tempOut();

    const result = await build(checkout, options(out));

    expect(result).toEqual({ kind: "site", out });
    expect(await readdir(out)).toEqual(expect.arrayContaining(["index.html", "site.json", "workspace.bundle.json", "bundles"]));
    expect(JSON.parse(await readFile(join(out, "bundles", "index.json"), "utf8"))).toMatchObject({ revisions: [] });
  });

  it("returns viewer-missing and writes nothing when the viewer isn't built", async () => {
    const { checkout } = await checkoutOf(validWorkspace);
    const out = await tempOut();
    const viewerDir = await mkdtemp(join(tmpdir(), "archidocs-no-viewer-"));

    expect(await build(checkout, options(out, { viewerDir }))).toEqual({ kind: "viewer-missing", viewerDir });
    expect(existsSync(out)).toBe(false);
  });

  it("writes a preview of HEAD against origin/<base>", async () => {
    const repo = await scriptedRepo();
    const base = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    repo.git("update-ref", "refs/remotes/origin/main", base);
    repo.git("checkout", "--quiet", "-b", "pr");
    const head = await repo.commit("Add wishlist", "2026-02-10T12:00:00Z", { "archidocs/shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n" });
    const out = await tempOut();

    const result = await build(checkoutAt(join(repo.repoRoot, "archidocs")), options(out, { preview: { base: "main" } }));

    expect(result).toEqual({ kind: "preview", out, base: "main", baseSha: base, headSha: head });
    expect((await readdir(join(out, "bundles"))).sort()).toEqual([`${base}.json`, `${head}.json`, "index.json"].sort());
  });

  it("writes nothing for a preview whose base is missing", async () => {
    const repo = await scriptedRepo();
    await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    const out = await tempOut();

    await expect(build(checkoutAt(join(repo.repoRoot, "archidocs")), options(out, { preview: { base: "main" } }))).rejects.toThrow(
      "origin/main is not in this checkout; fetch the base branch before building (archidocs never fetches).",
    );
    expect(existsSync(out)).toBe(false);
  });

  it("returns not-in-git for a preview outside git", async () => {
    const { checkout } = await checkoutOutsideGit(validWorkspace);
    const out = await tempOut();

    expect(await build(checkout, options(out, { preview: {} }))).toEqual({ kind: "not-in-git" });
    expect(existsSync(out)).toBe(false);
  });
});
