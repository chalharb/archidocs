import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { PALETTES } from "../../src/render/index.ts";
import { archidocs } from "../support/cli.ts";
import { checkoutScenarioWorkspace, landscapeWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

/** The landscape fixture plus Saved Views in an `architecture` Project, one of them a Deployment View. */
const withSavedViews = {
  ...landscapeWorkspace,
  "architecture/project.yaml": "id: architecture\nname: Architecture\nowner: platform-team\n",
  "architecture/views.yaml": `views:
  structural:
    purchase:
      title: Purchase
      level: c2
      include: [{ from: shop:shopper, to: payments:payments-api }]
      direction: TB
      lens: { impact: shop:cart, direction: upstream }
    systems:
      title: Systems
      level: c1
    runtime:
      title: Runtime
      level: deployment
      environment: prod
`,
};

/** The landscape fixture committed once, so pictures have a source commit. */
async function committedLandscape(files = landscapeWorkspace) {
  const { repoRoot } = await writeWorkspace(files);
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

  it("draws the C2 Landscape with its Systems open, their Services inside", async () => {
    const { repoRoot } = await committedLandscape();
    await archidocs(repoRoot, "export", "c1", "--format", "svg", "--out", "c1.svg");
    await archidocs(repoRoot, "export", "c2", "--format", "svg", "--out", "c2.svg");

    expect(texts(await readFile(join(repoRoot, "c1.svg"), "utf8"))).not.toContain("Cart DB");
    expect(texts(await readFile(join(repoRoot, "c2.svg"), "utf8"))).toEqual(expect.arrayContaining(["C2 Landscape", "Cart DB", "Payments API"]));
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

  it("writes a Saved View with its Lens, in the View's own direction unless --direction overrides it", async () => {
    const { repoRoot } = await committedLandscape(withSavedViews);
    const { code, stdout } = await archidocs(repoRoot, "export", "architecture:purchase");
    await archidocs(repoRoot, "export", "architecture:purchase", "--direction", "LR", "--out", "lr.svg");

    expect(code).toBe(0);
    expect(stdout).toBe("Wrote architecture-purchase.svg\n");
    const svg = await readFile(join(repoRoot, "architecture-purchase.svg"), "utf8");
    expect(texts(svg)).toContain("Lens: Impact of Cart, upstream");
    const [tb, lr] = [svgSize(svg), svgSize(await readFile(join(repoRoot, "lr.svg"), "utf8"))];
    expect(tb[0]! / tb[1]!).toBeLessThan(lr[0]! / lr[1]!);
  });

  it("--all-saved writes every Saved View into --out, Deployment Views included", async () => {
    const { repoRoot } = await committedLandscape(withSavedViews);
    const { code, stdout, stderr } = await archidocs(repoRoot, "export", "--all-saved", "--out", "docs/views", "--format", "png");

    expect(code).toBe(0);
    expect(stdout).toBe("Wrote docs/views/architecture-purchase.png\nWrote docs/views/architecture-runtime.png\nWrote docs/views/architecture-systems.png\n");
    expect(stderr).toBe("");
    expect((await readdir(join(repoRoot, "docs/views"))).sort()).toEqual(["architecture-purchase.png", "architecture-runtime.png", "architecture-systems.png"]);
  });

  it("draws an Environment's Deployment View top to bottom, with its Targets, System boxes and Deployments", async () => {
    const { repoRoot } = await committedLandscape();
    const { code, stdout } = await archidocs(repoRoot, "export", "deployment/prod");

    expect([code, stdout]).toEqual([0, "Wrote deployment-prod.svg\n"]);
    const svg = await readFile(join(repoRoot, "deployment-prod.svg"), "utf8");
    expect(texts(svg)[0]).toBe("Production (Deployment)");
    expect(texts(svg)).toEqual(expect.arrayContaining(["AWS eu-west-1 · region", "EKS prod · cluster", "Checkout · System", "Cart", "Payments API"]));
  });

  it("draws a Dynamic View as a sequence chart, as SVG or PNG", async () => {
    const { repoRoot } = await committedLandscape(checkoutScenarioWorkspace);
    const svgRun = await archidocs(repoRoot, "export", "shop:pay");
    const pngRun = await archidocs(repoRoot, "export", "shop:pay", "--format", "png", "--out", "pay.png");

    expect([svgRun.code, svgRun.stdout]).toEqual([0, "Wrote shop-pay.svg\n"]);
    const svg = await readFile(join(repoRoot, "shop-pay.svg"), "utf8");
    expect(texts(svg)[0]).toBe("Pay for an order");
    expect(texts(svg)).toEqual(expect.arrayContaining(["Checkout API", "Payments API", "Fraud Scorer", "1", "4"]));
    expect(svg.match(/<path data-step=/g)).toHaveLength(4);
    expect(pngRun.code).toBe(0);
    expect(PNG.sync.read(await readFile(join(repoRoot, "pay.png"))).width).toBeGreaterThan(0);
  });

  it("--all-saved draws Dynamic Views as sequence charts too", async () => {
    const { repoRoot } = await committedLandscape(checkoutScenarioWorkspace);
    const { code, stdout, stderr } = await archidocs(repoRoot, "export", "--all-saved", "--out", "views");

    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toBe("Wrote views/shop-full-checkout.svg\nWrote views/shop-pay.svg\n");
  });

  it.each([
    [["export", "--all-saved"], "--all-saved needs --out"],
    [["export", "c1", "--all-saved", "--out", "x"], "Give a View or --all-saved, not both"],
    [["export", "c9"], 'Unknown View "c9"'],
    [["export"], "Give the View to export"],
    [["export", "c1", "--format", "pdf"], 'Unknown format "pdf"'],
    [["export", "c1", "--direction", "UP"], 'Unknown direction "UP"'],
    [["export", "c1", "--theme", "sepia"], 'Unknown theme "sepia"'],
  ])("exits 2 for %j", async (args, message) => {
    const { repoRoot } = await committedLandscape();
    const { code, stderr } = await archidocs(repoRoot, ...args);

    expect(code).toBe(2);
    expect(stderr).toContain(message);
  });

  it("draws light by default, and dark with --theme dark, as SVG and PNG", async () => {
    const { repoRoot } = await committedLandscape();
    const runs = await Promise.all([
      archidocs(repoRoot, "export", "c1", "--out", "light.svg"),
      archidocs(repoRoot, "export", "c1", "--theme", "dark", "--out", "dark.svg"),
      archidocs(repoRoot, "export", "c1", "--out", "light.png", "--format", "png"),
      archidocs(repoRoot, "export", "c1", "--theme", "dark", "--out", "dark.png", "--format", "png"),
    ]);

    expect(runs.map((r) => r.code)).toEqual([0, 0, 0, 0]);
    expect(await readFile(join(repoRoot, "light.svg"), "utf8")).toContain(`fill="${PALETTES.light.ground}"/>`);
    expect(await readFile(join(repoRoot, "dark.svg"), "utf8")).toContain(`fill="${PALETTES.dark.ground}"/>`);
    // The top-left pixel is the ground.
    const corner = async (file: string) => [...PNG.sync.read(await readFile(join(repoRoot, file))).data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
    expect(`#${await corner("light.png")}`).toBe(PALETTES.light.ground);
    expect(`#${await corner("dark.png")}`).toBe(PALETTES.dark.ground);
  }, 20_000);

  it("--label replaces the source line, for one View and for --all-saved", async () => {
    const { repoRoot } = await committedLandscape(withSavedViews);
    const [one, all] = await Promise.all([
      archidocs(repoRoot, "export", "c1", "--label", "Big Bank · v1.2.0", "--theme", "dark"),
      archidocs(repoRoot, "export", "--all-saved", "--out", "views", "--label", "Big Bank · v1.2.0", "--theme", "dark"),
    ]);

    expect([one.code, all.code]).toEqual([0, 0]);
    for (const file of ["c1.svg", ...(await readdir(join(repoRoot, "views"))).map((f) => join("views", f))]) {
      const svg = await readFile(join(repoRoot, file), "utf8");
      expect([file, texts(svg)[1]]).toEqual([file, "Big Bank · v1.2.0"]);
      expect(svg).toContain(`fill="${PALETTES.dark.ground}"/>`);
    }
  }, 20_000);

  it("writes nothing and exits 1 when the Workspace has errors", async () => {
    const { repoRoot } = await writeWorkspace({ ...landscapeWorkspace, "shop/more.yaml": "services:\n  extra:\n    name: Extra\n    owner: nobody\n" });
    const { code, stdout } = await archidocs(repoRoot, "export", "c1", "--out", "c1.svg");

    expect(code).toBe(1);
    expect(stdout).toContain("unknown-team");
  });
});
