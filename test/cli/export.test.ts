import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { archidocs } from "../support/cli.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

/** The landscape fixture committed once, so pictures have a source commit. */
async function committedLandscape() {
  const { repoRoot } = await writeWorkspace(landscapeWorkspace);
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd: repoRoot, encoding: "utf8" }).trim();
  git("add", ".");
  git("commit", "--quiet", "-m", "Landscape", "--date", "2026-11-20T09:00:00Z");
  return { repoRoot, sha: git("rev-parse", "HEAD"), date: git("log", "-1", "--format=%cs") };
}

const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1]);
const svgSize = (svg: string) => svg.match(/<svg[^>]* width="(\d+)" height="(\d+)"/)!.slice(1).map(Number);

describe("archidocs export", () => {
  it("writes a View as SVG, titled and with its Workspace, short commit and date", async () => {
    const { repoRoot, sha, date } = await committedLandscape();
    const { code, stdout } = await archidocs(repoRoot, "export", "c2/shop:checkout", "--format", "svg", "--out", "checkout.svg");

    expect(code).toBe(0);
    expect(stdout).toBe("Wrote checkout.svg\n");
    const svg = await readFile(join(repoRoot, "checkout.svg"), "utf8");
    expect(texts(svg).slice(0, 2)).toEqual(["Checkout (C2)", `${basename(repoRoot)} · ${sha.slice(0, 7)} · ${date}`]);
  });

  it("gives byte-identical SVG for the same View at the same commit", async () => {
    const { repoRoot } = await committedLandscape();
    await archidocs(repoRoot, "export", "c1", "--format", "svg", "--out", "a.svg");
    await archidocs(repoRoot, "export", "c1", "--format", "svg", "--out", "b.svg");

    expect(await readFile(join(repoRoot, "b.svg"), "utf8")).toBe(await readFile(join(repoRoot, "a.svg"), "utf8"));
  });

  it("writes PNG at twice the SVG's size", async () => {
    const { repoRoot } = await committedLandscape();
    await archidocs(repoRoot, "export", "c3/shop:cart", "--format", "svg", "--out", "cart.svg");
    const { code } = await archidocs(repoRoot, "export", "c3/shop:cart", "--format", "png", "--out", "cart.png");

    expect(code).toBe(0);
    const png = PNG.sync.read(await readFile(join(repoRoot, "cart.png")));
    const [width, height] = svgSize(await readFile(join(repoRoot, "cart.svg"), "utf8"));
    expect([png.width, png.height]).toEqual([width! * 2, height! * 2]);
  });

  it("names the file after the View when --out is not given, and defaults to SVG", async () => {
    const { repoRoot } = await committedLandscape();
    const { code, stdout } = await archidocs(repoRoot, "export", "c2/shop:checkout");

    expect(code).toBe(0);
    expect(stdout).toBe("Wrote c2-shop-checkout.svg\n");
    expect(await readFile(join(repoRoot, "c2-shop-checkout.svg"), "utf8")).toMatch(/^<svg /);
  });

  it("draws in the --direction it is given", async () => {
    const { repoRoot } = await committedLandscape();
    await archidocs(repoRoot, "export", "c1", "--out", "lr.svg");
    await archidocs(repoRoot, "export", "c1", "--out", "tb.svg", "--direction", "TB");

    const [lr, tb] = [svgSize(await readFile(join(repoRoot, "lr.svg"), "utf8")), svgSize(await readFile(join(repoRoot, "tb.svg"), "utf8"))];
    expect(lr[0]! / lr[1]!).toBeGreaterThan(tb[0]! / tb[1]!);
  });

  it.each([
    [["export", "c9"], 'Unknown View "c9"'],
    [["export"], "Give the View to export"],
    [["export", "c1", "--format", "pdf"], 'Unknown format "pdf"'],
    [["export", "c1", "--direction", "UP"], 'Unknown direction "UP"'],
  ])("exits 2 for %j", async (args, message) => {
    const { repoRoot } = await committedLandscape();
    const { code, stderr } = await archidocs(repoRoot, ...args);

    expect(code).toBe(2);
    expect(stderr).toContain(message);
  });

  it("writes nothing and exits 1 when the Workspace has errors", async () => {
    const { repoRoot } = await writeWorkspace({ ...landscapeWorkspace, "shop/more.yaml": "services:\n  extra:\n    name: Extra\n    owner: nobody\n" });
    const { code, stdout } = await archidocs(repoRoot, "export", "c1", "--out", "c1.svg");

    expect(code).toBe(1);
    expect(stdout).toContain("unknown-team");
  });
});
