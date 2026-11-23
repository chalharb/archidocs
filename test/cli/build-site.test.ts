import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landscapeWorkspace, relationshipWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";
import { archidocs } from "../support/cli.ts";
import { writeWorkspace } from "../support/workspace.ts";

// The site build copies the prebuilt viewer, which test/support/viewer-build.ts builds once per run.
describe("archidocs build --out", () => {
  it("writes the viewer and the latest Bundle into one folder", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);
    const { code, stdout } = await archidocs(repoRoot, "build", "--out", "site");

    expect(code).toBe(0);
    expect(stdout).toBe("Wrote the site to site\n");
    const site = join(repoRoot, "site");
    expect((await readdir(site)).sort()).toEqual(["assets", "bundles", "index.html", "workspace.bundle.json"]);
    const bundle = JSON.parse(await readFile(join(site, "workspace.bundle.json"), "utf8"));
    expect(bundle.elements.map((e: { id: string }) => e.id)).toContain("shop:checkout");
  });

  it("refers to every asset by a relative URL, so the site works under any base path", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);
    await archidocs(repoRoot, "build", "--out", "site");

    const html = await readFile(join(repoRoot, "site", "index.html"), "utf8");
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^\.\//);
  });

  it("writes nothing when the Workspace has an error", async () => {
    const { repoRoot } = await writeWorkspace({ ...landscapeWorkspace, "shop/more.yaml": "services:\n  extra:\n    name: Extra\n    owner: nobody\n" });
    const { code, stdout } = await archidocs(repoRoot, "build", "--out", "site");

    expect(code).toBe(1);
    expect(stdout).toContain("unknown-team");
    expect(existsSync(join(repoRoot, "site"))).toBe(false);
  });

  /** Four Revisions, newest first: rename web again, add wishlist, rename web (tagged v1), the first model. */
  async function repoWithFourRevisions() {
    const repo = await scriptedRepo();
    const web = (name: string) => relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", `name: ${name}`);
    const first = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    const second = await repo.commit("Rename web", "2026-01-20T12:00:00Z", { "archidocs/shop/web.yaml": web("Web shop") });
    const third = await repo.commit("Add wishlist", "2026-02-10T12:00:00Z", { "archidocs/shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n" });
    const fourth = await repo.commit("Rename web again", "2026-03-10T12:00:00Z", { "archidocs/shop/web.yaml": web("Storefront") });
    repo.git("tag", "v1", second);
    return { repo, shas: [fourth, third, second, first] };
  }

  const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
  const bundleFiles = async (site: string) => (await readdir(join(site, "bundles"))).filter((f) => f !== "index.json").sort();

  it("writes a past Bundle per Revision and the Revision index, keeping the latest --keep plus every tag", async () => {
    const { repo, shas } = await repoWithFourRevisions();
    const [fourth, third, second, first] = shas as [string, string, string, string];

    const { code, stderr } = await archidocs(repo.repoRoot, "build", "--out", "site", "--keep", "2");

    expect(stderr).toBe("");
    expect(code).toBe(0);
    const site = join(repo.repoRoot, "site");
    const index = await readJson(join(site, "bundles", "index.json"));
    expect(index.schemaVersion).toBe(1);
    expect(index.revisions.map((r: { sha: string; subject: string; tags: string[]; bundle: boolean }) => [r.sha, r.subject, r.tags, r.bundle])).toEqual([
      [fourth, "Rename web again", [], true],
      [third, "Add wishlist", [], true],
      [second, "Rename web", ["v1"], true],
      [first, "Model", [], false],
    ]);
    expect(index.revisions[3]).toMatchObject({ date: "2026-01-10T12:00:00Z", author: "Ana Author", counts: { added: 30, removed: 0, changed: 0 } });
    expect(index.revisions[3].changedIds).toContain("shop:web");
    expect(index.revisions[1]).toMatchObject({ counts: { added: 1, removed: 0, changed: 0 }, changedIds: ["shop:wishlist"] });
    expect(await bundleFiles(site)).toEqual([fourth, third, second].map((s) => `${s}.json`).sort());
    const past = await readJson(join(site, "bundles", `${second}.json`));
    expect(past).toMatchObject({ commit: second, builtAt: "2026-01-20T12:00:00Z" });
    expect(past.elements.find((e: { id: string }) => e.id === "shop:web").name).toBe("Web shop");
  });

  it("keeps every Bundle with --keep all, and drops a Bundle left from an earlier build once it falls out", async () => {
    const { repo, shas } = await repoWithFourRevisions();
    const site = join(repo.repoRoot, "site");

    await archidocs(repo.repoRoot, "build", "--out", "site", "--keep", "all");
    const all = await bundleFiles(site);
    const { code } = await archidocs(repo.repoRoot, "build", "--out", "site", "--keep", "1");
    const one = await bundleFiles(site);

    expect(code).toBe(0);
    expect(all).toEqual([...shas].map((s) => `${s}.json`).sort());
    expect(one).toEqual([shas[0], shas[2]].map((s) => `${s}.json`).sort());
    expect((await readJson(join(site, "bundles", "index.json"))).revisions.map((r: { bundle: boolean }) => r.bundle)).toEqual([true, false, true, false]);
  });

  it("rebuilds every past Bundle from git when the cache is empty, byte for byte, fetching nothing", async () => {
    const { repo, shas } = await repoWithFourRevisions();
    await archidocs(repo.repoRoot, "build", "--out", "warm", "--keep", "all");
    await rm(join(repo.repoRoot, ".archidocs"), { recursive: true });

    const { code } = await archidocs(repo.repoRoot, "build", "--out", "cold", "--keep", "all");

    expect(code).toBe(0);
    expect(await bundleFiles(join(repo.repoRoot, "cold"))).toEqual([...shas].map((s) => `${s}.json`).sort());
    for (const file of [...(await bundleFiles(join(repo.repoRoot, "warm"))), "index.json"]) {
      expect(await readFile(join(repo.repoRoot, "cold", "bundles", file), "utf8")).toBe(await readFile(join(repo.repoRoot, "warm", "bundles", file), "utf8"));
    }
    expect(existsSync(join(repo.repoRoot, ".archidocs", "cache", "bundles", `${shas[3]}.json`))).toBe(true);
  });

  it("refuses a --keep that is not a count or all", async () => {
    const { repo } = await repoWithFourRevisions();
    const { code, stderr } = await archidocs(repo.repoRoot, "build", "--out", "site", "--keep", "some");

    expect(code).toBe(2);
    expect(stderr).toContain('--keep "some" is not a count or all');
  });
});
