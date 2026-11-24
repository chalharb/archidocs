/**
 * The share images, drawn from the mark in `assets/brand/` and rasterised
 * with the renderer's own resvg and embedded Overpass, so they follow the
 * brand without a committed PNG.
 */
import { renderPngInNode } from "../../../src/render/node.ts";
import { readRepoFile } from "./repo.ts";
import { SHARE_IMAGE, TOUCH_ICON } from "./share.ts";

/** The mark's two paths from a brand SVG, without its <svg> wrapper. */
const markPaths = (file: string): string => {
  const svg = readRepoFile(file);
  const paths = svg.match(/<path\b[^>]*\/>/g);
  if (!paths?.length) throw new Error(`No mark paths in ${file}.`);
  return paths.join("");
};

/** The 1200×630 card: the light mark and the name on the plate navy, the tagline under them. */
export function shareCardSvg(): string {
  const { width, height } = SHARE_IMAGE;
  const plate = "#1c2633";
  const onPlate = "#ffffff";
  const plateMuted = "#c3cbd6";
  const plateLine = "#48566b";
  const here = "#ffc629";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${plate}"/>
<rect x="0" y="${height - 12}" width="${width}" height="12" fill="${here}"/>
<g transform="translate(96 150) scale(2.5)">${markPaths("assets/brand/archidocs-mark-light.svg")}</g>
<text x="290" y="262" font-family="Overpass" font-weight="700" font-size="96" fill="${onPlate}">Archidocs</text>
<line x1="96" y1="360" x2="${width - 96}" y2="360" stroke="${plateLine}" stroke-width="2"/>
<text font-family="Overpass" font-weight="700" font-size="44" fill="${onPlate}"><tspan x="96" y="440">One architecture, the same answer</tspan><tspan x="96" y="500">for people and agents.</tspan></text>
<text x="${width - 96}" y="500" text-anchor="end" font-family="Overpass" font-weight="400" font-size="30" fill="${plateMuted}">archidocs.dev</text>
</svg>`;
}

export const shareCardPng = (): Promise<Uint8Array> => renderPngInNode(shareCardSvg(), { scale: 1 });

/** The dark app icon at 180×180, the size iOS and macOS ask for. */
export const touchIconPng = (): Promise<Uint8Array> => {
  const icon = readRepoFile("assets/brand/archidocs-icon-dark.svg");
  // The icon's rounded corners would show as transparent; Apple rounds the square itself.
  const square = icon.replace(/<rect([^>]*?) rx="\d+"/, "<rect$1");
  return renderPngInNode(square, { scale: TOUCH_ICON.size / 80 });
};
