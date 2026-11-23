import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { landscapeWorkspace } from "../support/fixtures.ts";
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
    expect((await readdir(site)).sort()).toEqual(["assets", "index.html", "site.json", "workspace.bundle.json"]);
    const bundle = JSON.parse(await readFile(join(site, "workspace.bundle.json"), "utf8"));
    expect(bundle.elements.map((e: { id: string }) => e.id)).toContain("shop:checkout");
  });

  it("names the Workspace in site.json as archidocs export names it, so viewer exports carry the same source line", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);
    await archidocs(repoRoot, "build", "--out", "site");

    expect(JSON.parse(await readFile(join(repoRoot, "site", "site.json"), "utf8"))).toEqual({ workspace: basename(repoRoot) });
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
});
