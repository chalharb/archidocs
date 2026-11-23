import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { resolveView } from "../../src/core/index.ts";
import { layoutView, renderSvg } from "../../src/render/index.ts";
import { renderPngInNode } from "../../src/render/node.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

async function svgOf(viewId: string) {
  const { bundle } = await loadWorkspace(landscapeWorkspace);
  const view = resolveView(bundle, viewId)!;
  return renderSvg({ bundle, view, layout: await layoutView(view), source: { workspace: "acme", commit: null, date: null } });
}

const sizeOf = (svg: string) => {
  const [, width, height] = svg.match(/<svg[^>]* width="(\d+)" height="(\d+)"/)!;
  return { width: Number(width), height: Number(height) };
};

describe("PNG export", () => {
  it("decodes, at twice the SVG's size by default", async () => {
    const svg = await svgOf("c2/shop:checkout");
    const png = PNG.sync.read(Buffer.from(await renderPngInNode(svg)));

    const { width, height } = sizeOf(svg);
    expect([png.width, png.height]).toEqual([width * 2, height * 2]);
  });

  it("scales by the factor it is given", async () => {
    const svg = await svgOf("c1");
    const png = PNG.sync.read(Buffer.from(await renderPngInNode(svg, { scale: 1 })));

    expect([png.width, png.height]).toEqual(Object.values(sizeOf(svg)));
  });

  it("draws the title with the embedded font, not a font installed on the machine", async () => {
    const svg = await svgOf("c1");
    const png = PNG.sync.read(Buffer.from(await renderPngInNode(svg, { scale: 1 })));

    // The title sits in the band from y=14 to y=40, left of x=200; count its dark pixels.
    let ink = 0;
    for (let y = 14; y < 40; y++)
      for (let x = 24; x < 200; x++) {
        const i = (y * png.width + x) * 4;
        if (png.data[i]! < 128 && png.data[i + 3]! > 0) ink++;
      }
    expect(ink).toBeGreaterThan(100);
  });
});
