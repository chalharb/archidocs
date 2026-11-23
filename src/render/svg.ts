import type { ResolvedView, ViewEdge, ViewNode } from "../core/views.ts";
import { describeLens } from "../core/saved-views.ts";
import type { Bundle, BundleElement } from "../schema/bundle.ts";
import { ADVANCES, FONT_BASE64, FONT_FAMILY, UNITS_PER_EM } from "./font.ts";
import type { Layout, LaidOutNode } from "./layout.ts";
import { teamStyles, type TeamStyle } from "./teams.ts";

/** Where a picture comes from, for its source line: the Workspace's name, the commit and its date (both null before the first commit). */
export interface RenderSource {
  workspace: string;
  commit: string | null;
  date: string | null;
}

export interface RenderInput {
  /** The Bundle the View was resolved from: it gives each node's Owner, Team and technology. */
  bundle: Bundle;
  view: ResolvedView;
  layout: Layout;
  source: RenderSource;
}

const PAD = 24;
const HEADER = 72;
const KEY = 44;

const COLOR = {
  background: "#ffffff",
  ink: "#1b2330",
  muted: "#5b6573",
  border: "#8a94a3",
  node: "#ffffff",
  system: "#eef1f5",
  container: "#f6f8fa",
  edge: "#5b6573",
  lens: "#c2410c",
};

/** How far a node or edge the Lens misses fades. */
const DIM = 0.35;

/**
 * Draws a laid-out View as one SVG document: the title and source line, the
 * nodes and edges, and a key. It is a pure function of its input, so the same
 * View at the same commit always gives the same bytes; it needs no DOM, and
 * runs in Node and the browser alike.
 */
export function renderSvg({ bundle, view, layout, source }: RenderInput): string {
  const elements = new Map(bundle.elements.map((e) => [e.id, e]));
  const teams = teamStyles(bundle);
  const boxes = new Map(layout.nodes.map((n) => [n.id, n]));
  const containers = new Set(view.nodes.map((n) => n.parent).filter((p) => p !== null));

  const title = view.title;
  const sourceLine = [source.workspace, source.commit?.slice(0, 7) ?? "uncommitted", ...(source.date ? [source.date.slice(0, 10)] : [])].join(" · ");
  const key = drawKey(view.lens ? `Lens: ${describeLens(view.lens)}` : undefined);
  const width = Math.ceil(Math.max(layout.width, key.width, textWidth(title, 20), textWidth(sourceLine, 12)) + 2 * PAD);
  const height = Math.ceil(HEADER + layout.height + PAD + KEY);

  const depth = (n: ViewNode): number => (n.parent === null ? 0 : 1 + depth(view.nodes.find((p) => p.id === n.parent)!));
  const byDepth = view.nodes.map((n) => ({ n, d: depth(n) })).sort((a, b) => a.d - b.d).map(({ n }) => n);
  const drawn = (n: ViewNode) => {
    const box = boxes.get(n.id)!;
    const element = elements.get(n.id);
    const team = element ? teams.get(element.owner) : undefined;
    const drawing = containers.has(n.id) ? drawContainer(n, box, team) : drawNode(n, box, element, team);
    return n.mark && !n.mark.hit ? `<g opacity="${DIM}">${drawing}</g>` : drawing;
  };

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY}, sans-serif">`,
    `<style>@font-face{font-family:"${FONT_FAMILY}";src:url(data:font/ttf;base64,${FONT_BASE64}) format("truetype")}</style>`,
    `<defs>${marker("arrow", COLOR.edge)}${view.lens ? marker("arrow-lit", COLOR.lens) : ""}</defs>`,
    `<rect width="${width}" height="${height}" fill="${COLOR.background}"/>`,
    text(PAD, 34, title, { size: 20, fill: COLOR.ink }),
    text(PAD, 56, sourceLine, { size: 12, fill: COLOR.muted }),
    `<g transform="translate(${PAD},${HEADER})">`,
    ...byDepth.filter((n) => containers.has(n.id)).map(drawn),
    ...layout.edges.map((e) => drawEdge(e.points, view.edges.find((v) => v.from === e.from && v.to === e.to)!)),
    ...byDepth.filter((n) => !containers.has(n.id)).map(drawn),
    `</g>`,
    `<g transform="translate(${PAD},${fmt(HEADER + layout.height + PAD)})">`,
    ...key.parts,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n");
}

const marker = (id: string, fill: string) =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${fill}"/></marker>`;

/** A node's outline: the Lens colour, thicker, when the Lens hits it. */
const outline = (n: ViewNode) => (n.mark?.hit ? `stroke="${COLOR.lens}" stroke-width="2.5"` : `stroke="${COLOR.border}" stroke-width="1.25"`);

/** A badge on a node's top-left corner with its distance from the impact's origin. */
function distanceBadge(n: ViewNode, box: LaidOutNode): string[] {
  if (n.mark?.distance === undefined) return [];
  const label = String(n.mark.distance);
  const r = 9;
  return [
    `<circle cx="${fmt(box.x)}" cy="${fmt(box.y)}" r="${r}" fill="${COLOR.lens}"/>`,
    text(box.x - textWidth(label, 10) / 2, box.y + 3.5, label, { size: 10, fill: COLOR.background }),
  ];
}

function drawNode(n: ViewNode, box: LaidOutNode, element: BundleElement | undefined, team: TeamStyle | undefined): string {
  const { x, y, width: w, height: h } = box;
  const person = n.kind === "person";
  const dash = n.external ? ` stroke-dasharray="6 4"` : "";
  const fill = n.kind === "system" ? COLOR.system : COLOR.node;
  // A Person's pill has no corner to hold a Team code, so only the other kinds show one.
  const code = person ? "" : (team?.code ?? "");
  const codeWidth = code ? textWidth(code, 10) + 8 : 0;
  const left = person ? 20 : 16;
  return [
    `<g>`,
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${person ? fmt(h / 2) : 8}" fill="${fill}" ${outline(n)}${dash}/>`,
    ...(team && !person ? [`<rect x="${fmt(x + 1)}" y="${fmt(y + 1)}" width="5" height="${fmt(h - 2)}" fill="${team.color}"/>`] : []),
    text(x + left, y + h / 2 - 4, cut(n.name, 14, w - left - 10 - codeWidth), { size: 14, fill: COLOR.ink }),
    text(x + left, y + h / 2 + 14, cut(subLabel(n, element), 11, w - left - 10), { size: 11, fill: COLOR.muted }),
    ...(code ? [text(x + w - 10, y + 18, code, { size: 10, fill: COLOR.muted, anchor: "end" })] : []),
    ...distanceBadge(n, box),
    `</g>`,
  ].join("");
}

function drawContainer(n: ViewNode, box: LaidOutNode, team: TeamStyle | undefined): string {
  const { x, y, width: w, height: h } = box;
  const dash = n.external ? ` stroke-dasharray="6 4"` : "";
  const code = team?.code ?? "";
  const codeWidth = code ? textWidth(code, 10) + 8 : 0;
  return [
    `<g>`,
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="10" fill="${COLOR.container}" ${outline(n)}${dash}/>`,
    ...(team ? [`<rect x="${fmt(x + 1)}" y="${fmt(y + 1)}" width="5" height="${fmt(h - 2)}" fill="${team.color}"/>`] : []),
    text(x + 16, y + 24, cut(`${n.name} · ${kindName(n)}`, 13, w - 26 - codeWidth), { size: 13, fill: COLOR.ink }),
    ...(code ? [text(x + w - 10, y + 22, code, { size: 10, fill: COLOR.muted, anchor: "end" })] : []),
    ...distanceBadge(n, box),
    `</g>`,
  ].join("");
}

function drawEdge(points: { x: number; y: number }[], edge: ViewEdge): string {
  const async = edge.relationships.every((r) => r.interaction === "async");
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)},${fmt(p.y)}`).join(" ");
  const dash = async ? ` stroke-dasharray="6 4"` : "";
  if (edge.lit) return `<path d="${d}" fill="none" stroke="${COLOR.lens}" stroke-width="2"${dash} marker-end="url(#arrow-lit)"/>`;
  const path = `<path d="${d}" fill="none" stroke="${COLOR.edge}" stroke-width="1.25"${dash} marker-end="url(#arrow)"/>`;
  return edge.lit === false ? `<g opacity="${DIM}">${path}</g>` : path;
}

/** The key: what the line styles, the Team stripe and code, and a dashed box mean, and the Lens if there is one. */
function drawKey(lens: string | undefined): { parts: string[]; width: number } {
  const parts: string[] = [];
  let x = 0;
  const label = (s: string) => {
    parts.push(text(x, 16, s, { size: 11, fill: COLOR.muted }));
    x += textWidth(s, 11) + 24;
  };
  for (const [name, dash] of [["Sync", ""], ["Async", ` stroke-dasharray="6 4"`]] as const) {
    parts.push(`<path d="M${x},12 L${x + 32},12" fill="none" stroke="${COLOR.edge}" stroke-width="1.25"${dash} marker-end="url(#arrow)"/>`);
    x += 40;
    label(name);
  }
  parts.push(`<rect x="${x}" y="2" width="36" height="20" rx="4" fill="${COLOR.node}" stroke="${COLOR.border}"/>`);
  parts.push(`<rect x="${x + 1}" y="3" width="5" height="18" fill="${COLOR.muted}"/>`);
  parts.push(text(x + 33, 15, "ABC", { size: 8, fill: COLOR.muted, anchor: "end" }));
  x += 44;
  label("Team (stripe and code)");
  parts.push(`<rect x="${x}" y="2" width="36" height="20" rx="4" fill="${COLOR.node}" stroke="${COLOR.border}" stroke-dasharray="6 4"/>`);
  x += 44;
  label("External");
  if (lens) {
    parts.push(`<rect x="${x}" y="2" width="36" height="20" rx="4" fill="${COLOR.node}" stroke="${COLOR.lens}" stroke-width="2.5"/>`);
    x += 44;
    label(lens);
  }
  return { parts, width: x - 24 };
}

const kindName = (n: ViewNode) => ({ person: "Person", system: "System", service: "Service", component: "Component" })[n.kind];

/** The line under a node's name: External, its kind (or Service type), and its technology. */
function subLabel(n: ViewNode, element: BundleElement | undefined): string {
  const type = element?.kind === "service" && element.type !== "app" ? { datastore: "Datastore", broker: "Broker" }[element.type] : kindName(n);
  const technology = element && "technology" in element ? element.technology : null;
  return [`${n.external ? "External " : ""}${type}`, ...(technology ? [technology] : [])].join(" · ");
}

/** A string's width in the embedded font at `size` px. */
export function textWidth(s: string, size: number): number {
  let units = 0;
  for (const ch of s) units += ADVANCES[ch.codePointAt(0)!] ?? ADVANCES[77]!;
  return (units * size) / UNITS_PER_EM;
}

/** `s` if it fits in `max` px, else as much of it as fits followed by an ellipsis. */
export function cut(s: string, size: number, max: number): string {
  if (textWidth(s, size) <= max) return s;
  const chars = [...s];
  while (chars.length > 0 && textWidth(chars.join("").trimEnd() + "…", size) > max) chars.pop();
  return chars.join("").trimEnd() + "…";
}

function text(x: number, y: number, s: string, { size, fill, anchor }: { size: number; fill: string; anchor?: "end" }): string {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${fill}"${anchor ? ` text-anchor="${anchor}"` : ""}>${escape(s)}</text>`;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A coordinate to at most two decimals, so output doesn't depend on float noise. */
function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}
