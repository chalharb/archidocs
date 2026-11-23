import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landscapeWorkspace, relationshipWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";
import { archidocs } from "../support/cli.ts";

const web = (name: string) => relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", `name: ${name}`);
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

/**
 * A PR checkout: `main` has the model, a rename of Web, a second rename and
 * a README edit; the PR branched after the first rename and adds Wishlist.
 * `origin/main` is set as a fetch would leave it, but no remote exists, so
 * anything that tried to fetch would fail. Local `main` is stale on purpose.
 */
async function prCheckout() {
  const repo = await scriptedRepo();
  const model = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
  await repo.commit("Rename web", "2026-01-20T12:00:00Z", { "archidocs/shop/web.yaml": web("Web shop") });
  repo.git("checkout", "--quiet", "-b", "pr");
  const head = await repo.commit("Add wishlist", "2026-02-10T12:00:00Z", { "archidocs/shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n" });
  repo.git("checkout", "--quiet", "main");
  const base = await repo.commit("Rename web again", "2026-02-20T12:00:00Z", { "archidocs/shop/web.yaml": web("Storefront") });
  const readme = await repo.commit("Edit the README", "2026-02-25T12:00:00Z", { "README.md": "# Shop\n" });
  repo.git("update-ref", "refs/remotes/origin/main", readme);
  repo.git("checkout", "--quiet", "pr");
  repo.git("branch", "--force", "main", model);
  return { repo, head, base };
}

describe("archidocs build --preview", () => {
  it("writes a site holding the PR head and the base's latest Revision from origin/<base>, and names them for Compare", async () => {
    const { repo, head, base } = await prCheckout();

    const { code, stdout, stderr } = await archidocs(repo.repoRoot, "build", "--out", "preview", "--preview", "--base", "main");

    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout).toBe(`Wrote the preview site to preview: Compare origin/main (${base.slice(0, 7)}) → PR (${head.slice(0, 7)})\n`);
    const site = join(repo.repoRoot, "preview");
    expect((await readdir(site)).sort()).toEqual(["assets", "bundles", "favicon.svg", "index.html", "site.json", "workspace.bundle.json"]);
    expect((await readdir(join(site, "bundles"))).sort()).toEqual([`${base}.json`, `${head}.json`, "index.json"].sort());
    const index = await readJson(join(site, "bundles", "index.json"));
    expect(index.preview).toEqual({ base: "main", baseSha: base, headSha: head });
    expect(index.revisions.map((r: { sha: string; subject: string; bundle: boolean }) => [r.sha, r.subject, r.bundle])).toEqual([
      [head, "Add wishlist", true],
      [base, "Rename web again", true],
    ]);
    // The head against the base: Wishlist added, and Web named "Web shop" where the base has "Storefront".
    expect(index.revisions[0]).toMatchObject({ counts: { added: 1, removed: 0, changed: 1 }, changedIds: ["shop:web", "shop:wishlist"] });
    expect((await readJson(join(site, "bundles", `${base}.json`))).elements.find((e: { id: string }) => e.id === "shop:web").name).toBe("Storefront");
    const latest = await readJson(join(site, "workspace.bundle.json"));
    expect(latest.commit).toBe(head);
    expect(latest.elements.map((e: { id: string }) => e.id)).toContain("shop:wishlist");
  });

  it("reads the base branch from origin/HEAD when no --base is given", async () => {
    const { repo, base } = await prCheckout();
    repo.git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");

    const { code } = await archidocs(repo.repoRoot, "build", "--out", "preview", "--preview");

    expect(code).toBe(0);
    expect((await readJson(join(repo.repoRoot, "preview", "bundles", "index.json"))).preview.baseSha).toBe(base);
  });

  it("Compares against an empty Model when the base has no Workspace yet, as in the PR that adds one", async () => {
    const repo = await scriptedRepo();
    const tip = await repo.commit("Start", "2026-01-10T12:00:00Z", { "README.md": "# Shop\n" });
    repo.git("update-ref", "refs/remotes/origin/main", tip);
    repo.git("checkout", "--quiet", "-b", "pr");
    const head = await repo.commit("Add the model", "2026-01-20T12:00:00Z", inWorkspace(landscapeWorkspace));

    const { code } = await archidocs(repo.repoRoot, "build", "--out", "preview", "--preview", "--base", "main");

    expect(code).toBe(0);
    const index = await readJson(join(repo.repoRoot, "preview", "bundles", "index.json"));
    expect(index.preview).toEqual({ base: "main", baseSha: tip, headSha: head });
    expect(index.revisions.map((r: { sha: string }) => r.sha)).toEqual([head, tip]);
    expect(index.revisions[0].counts).toEqual({ added: 30, removed: 0, changed: 0 });
    expect((await readJson(join(repo.repoRoot, "preview", "bundles", `${tip}.json`))).elements).toEqual([]);
  });

  it("refuses, writing nothing, when origin/<base> is not in the checkout, since it never fetches", async () => {
    const { repo } = await prCheckout();

    const { code, stderr } = await archidocs(repo.repoRoot, "build", "--out", "preview", "--preview", "--base", "develop");

    expect(code).toBe(2);
    expect(stderr).toContain("origin/develop is not in this checkout");
    expect(existsSync(join(repo.repoRoot, "preview"))).toBe(false);
  });

  it("refuses --keep and --bundle-only, which don't apply to a preview", async () => {
    const { repo } = await prCheckout();

    const keep = await archidocs(repo.repoRoot, "build", "--preview", "--base", "main", "--keep", "3");
    const bundleOnly = await archidocs(repo.repoRoot, "build", "--preview", "--base", "main", "--bundle-only");

    expect([keep.code, bundleOnly.code]).toEqual([2, 2]);
    expect(keep.stderr).toContain("--preview");
    expect(bundleOnly.stderr).toContain("--preview");
  });
});
