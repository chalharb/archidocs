import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { load, nodeFileSystem, resolveView } from "../../src/core/index.ts";
import { layoutView, PALETTES, renderSequenceSvg, renderSvg, teamStyles, themes, type Theme } from "../../src/render/index.ts";
import { flatten } from "../../src/render/tokens.ts";

const css = await readFile(new URL("../../viewer/src/styles.css", import.meta.url), "utf8");

/** The custom properties a CSS block sets directly to a colour, by name. */
function declared(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))\s*;/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

/** The viewer's light tokens (the first `:root`) and its Night shift dark ones (`:root` inside `prefers-color-scheme: dark`). */
const viewer: Record<Theme, Map<string, string>> = {
  light: declared(/:root\s*\{([\s\S]*?)\n\}/.exec(css)![1]!),
  dark: declared(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n {2}\}/.exec(css)![1]!),
};

describe("the shared diagram palette", () => {
  it.each(themes)("matches the viewer's %s tokens, one for one", (theme) => {
    for (const [name, value] of Object.entries(PALETTES[theme])) expect([name, viewer[theme].get(name)]).toEqual([name, value.toLowerCase()]);
  });
});

/** Every Saved View of each example Workspace, drawn in both themes. */
describe.each(["big-bank", "kitchen-sink"])("exports of examples/%s", async (example) => {
  const root = join(import.meta.dirname, "../../examples", example, "archidocs");
  const { bundle } = await load({ fs: nodeFileSystem(), root, repoRoot: join(root, "..") });
  const source = { workspace: example, commit: null, date: null };
  const draw = async (id: string, theme: Theme) => {
    const view = resolveView(bundle, id)!;
    if (view.kind === "dynamic") return renderSequenceSvg({ bundle, view, source, theme });
    return renderSvg({ bundle, view, layout: await layoutView(view, view.direction ? { direction: view.direction } : {}), source, theme });
  };
  const teamColours = [...teamStyles(bundle).values()].map((t) => t.color);

  it("has Saved Views to draw", () => {
    expect(bundle.views.length).toBeGreaterThan(0);
  });

  it.each(themes)("draws every Saved View in %s with no element below full opacity, and only the theme's colours", async (theme) => {
    const p = PALETTES[theme];
    const grounds = [p.ground, p["target-1"], p["target-2"], p["target-3"]];
    const allowed = new Set([...Object.values(p), ...grounds.map((g) => flatten(p.container, g)), ...teamColours, "none"].map((c) => c.toLowerCase()));
    for (const { id } of bundle.views) {
      const svg = await draw(id, theme);
      const opacities = [...svg.matchAll(/(?:^|[\s"])(?:fill-|stroke-)?opacity[=:]\s*"?([\d.]+)/g)].map((m) => Number(m[1]));
      expect([id, opacities.filter((o) => o < 1)]).toEqual([id, []]);
      expect([id, svg.match(/rgba\(/g)]).toEqual([id, null]);
      const colours = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]+|none)"/gi)].map((m) => m[1]!.toLowerCase());
      expect([id, colours.filter((c) => !allowed.has(c))]).toEqual([id, []]);
    }
  });
});
