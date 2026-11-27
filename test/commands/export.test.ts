import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { exportViews, type ExportOptions } from "../../src/commands/index.ts";
import { landscapeWorkspace, viewerWorkspace } from "../support/fixtures.ts";
import { brokenWorkspace, checkoutOf } from "./support.ts";

const tempDir = () => mkdtemp(join(tmpdir(), "archidocs-export-"));
const options = (out: string, more: Partial<ExportOptions> = {}): ExportOptions => ({ views: ["c1"], format: "svg", theme: "light", out, ...more });

describe("exportViews", () => {
  it("returns the issues and writes nothing when the Workspace has errors", async () => {
    const { checkout } = await checkoutOf(brokenWorkspace);
    const out = await tempDir();

    const result = await exportViews(checkout, options(out));

    expect(result.kind).toBe("errors");
    expect(await readdir(out)).toEqual([]);
  });

  it("returns unknown-view for an id that names no View, and writes nothing", async () => {
    const { checkout } = await checkoutOf(landscapeWorkspace);
    const out = await tempDir();

    expect(await exportViews(checkout, options(out, { views: ["c2/nowhere"] }))).toEqual({ kind: "unknown-view", id: "c2/nowhere" });
    expect(await readdir(out)).toEqual([]);
  });

  it("draws one View to a file named by its id, or to the given file", async () => {
    const { checkout } = await checkoutOf(landscapeWorkspace);
    const out = await tempDir();

    const named = await exportViews(checkout, options(out));
    const file = join(out, "landscape.svg");
    const given = await exportViews(checkout, options(out, { file }));

    expect(named).toEqual({ kind: "written", files: [{ view: "c1", path: join(out, "c1.svg") }] });
    expect(given).toEqual({ kind: "written", files: [{ view: "c1", path: file }] });
    expect(await readFile(file, "utf8")).toMatch(/^<svg /);
    expect(await readFile(file, "utf8")).toBe(await readFile(join(out, "c1.svg"), "utf8"));
  });

  it("draws every Saved View into the folder, creating it", async () => {
    const { checkout } = await checkoutOf(viewerWorkspace);
    const out = join(await tempDir(), "pictures");

    const result = await exportViews(checkout, options(out, { views: "all-saved" }));

    expect(result.kind).toBe("written");
    const files = result.kind === "written" ? result.files : [];
    expect(files.map((f) => f.view)).toEqual(expect.arrayContaining(["shop:checkout-impact", "shop:staging-deployment"]));
    expect((await readdir(out)).sort()).toEqual(files.map((f) => f.path.slice(out.length + 1)).sort());
  });

  it("gives Saved Views whose ids used to share a file name a file each", async () => {
    const { checkout } = await checkoutOf({
      ...landscapeWorkspace,
      "pay/project.yaml": "id: pay\nname: Pay\nowner: platform-team\n",
      "pay/views.yaml": "views:\n  structural:\n    core-flow:\n      title: Core flow\n      level: c1\n",
      "pay-core/project.yaml": "id: pay-core\nname: Pay core\nowner: platform-team\n",
      "pay-core/views.yaml": "views:\n  structural:\n    flow:\n      title: Flow\n      level: c1\n",
    });
    const out = await tempDir();

    const result = await exportViews(checkout, options(out, { views: "all-saved" }));

    expect(result.kind).toBe("written");
    expect((await readdir(out)).sort()).toEqual(["pay-core_flow.svg", "pay_core-flow.svg"]);
  });

  it("draws a PNG", async () => {
    const { checkout } = await checkoutOf(landscapeWorkspace);
    const out = await tempDir();

    const result = await exportViews(checkout, options(out, { format: "png" }));

    expect(result).toEqual({ kind: "written", files: [{ view: "c1", path: join(out, "c1.png") }] });
    expect([...(await readFile(join(out, "c1.png"))).subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("doesn't load resvg for an SVG", async () => {
    const { root } = await checkoutOf(landscapeWorkspace);
    const out = await tempDir();
    // A fresh Node, so nothing else has loaded resvg: a resolve hook records every module it loads.
    const script = `
      import { registerHooks } from "node:module";
      const loaded = [];
      registerHooks({ resolve: (specifier, context, next) => { const r = next(specifier, context); loaded.push(r.url); return r; } });
      const { exportViews } = await import(${JSON.stringify(fileURLToPath(new URL("../../src/commands/index.ts", import.meta.url)))});
      const { checkoutAt } = await import(${JSON.stringify(fileURLToPath(new URL("../../src/workspace/index.ts", import.meta.url)))});
      const result = await exportViews(checkoutAt(${JSON.stringify(root)}), { views: ["c1"], format: "svg", theme: "light", out: ${JSON.stringify(out)} });
      console.log(JSON.stringify({ kind: result.kind, resvg: loaded.filter((url) => url.includes("resvg")) }));
    `;

    const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script]);

    expect(JSON.parse(stdout)).toEqual({ kind: "written", resvg: [] });
  });
});
