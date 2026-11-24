import type { ResolvedView, ViewEdge, ViewNode } from "../core/views.ts";
import { describeLens } from "../core/saved-views.ts";
import type { Bundle, BundleElement, BundleLens } from "../schema/bundle.ts";
import { FONT_BASE64, FONT_FAMILY } from "./font.ts";
import type { Layout, LaidOutNode } from "./layout.ts";
import { teamStyles, type TeamStyle } from "./teams.ts";
import { cut, fmt, text, textWidth } from "./text.ts";
import { flatten, PALETTES, type Palette, type Theme } from "./tokens.ts";

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
  /** The palette: the viewer's light tokens (the default) or its Night shift dark ones. */
  theme?: Theme;
  /** Replaces the source line under the title, such as `Big Bank · v1.2.0`. */
  label?: string;
}

const PAD = 24;
const HEADER = 72;
const KEY = 44;
/** Every frame, as the viewer draws it. */
const FRAME = 1.5;
/** A node's Team-coloured left edge. */
const EDGE = 6;

/** The line under a picture's title: the label if given, else the Workspace, short commit and date. */
export const sourceLine = (source: RenderSource, label?: string) =>
  label ?? [source.workspace, source.commit?.slice(0, 7) ?? "uncommitted", ...(source.date ? [source.date.slice(0, 10)] : [])].join(" · ");

/** The `<svg>` open tag, embedded font and background every picture starts with. */
export const opening = (width: number, height: number, ground: string, defs: string) => [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY}, sans-serif">`,
  `<style>@font-face{font-family:"${FONT_FAMILY}";src:url(data:font/ttf;base64,${FONT_BASE64}) format("truetype")}</style>`,
  `<defs>${defs}</defs>`,
  `<rect width="${width}" height="${height}" fill="${ground}"/>`,
];

/**
 * Draws a laid-out View as one SVG document in the viewer's Wayfinding Plate
 * look: the title and source line, the nodes and edges, and a key. It is a
 * pure function of its input, so the same View at the same commit always
 * gives the same bytes; it needs no DOM, and runs in Node and the browser alike.
 * Nothing in it is faded: what a Lens leaves out steps back to solid faint colours.
 */
export function renderSvg({ bundle, view, layout, source, theme = "light", label }: RenderInput): string {
  const c = PALETTES[theme];
  const elements = new Map(bundle.elements.map((e) => [e.id, e]));
  const targets = new Map(bundle.targets.map((t) => [t.id, t]));
  const teams = teamStyles(bundle);
  const boxes = new Map(layout.nodes.map((n) => [n.id, n]));
  const containers = new Set(view.nodes.map((n) => n.parent).filter((p) => p !== null));

  const title = view.title;
  const subtitle = sourceLine(source, label);
  const key = drawKey(c, view.lens);
  const width = Math.ceil(Math.max(layout.width, key.width, textWidth(title, 20), textWidth(subtitle, 12)) + 2 * PAD);
  const height = Math.ceil(HEADER + layout.height + PAD + KEY);

  const depth = (n: ViewNode): number => (n.parent === null ? 0 : 1 + depth(view.nodes.find((p) => p.id === n.parent)!));
  const byDepth = view.nodes.map((n) => ({ n, d: depth(n) })).sort((a, b) => a.d - b.d).map(({ n }) => n);
  const ring = view.lens !== undefined && "team" in view.lens;
  let clips = 0;
  const drawn = (n: ViewNode) => {
    const box = boxes.get(n.id)!;
    const element = elements.get(n.element ?? n.id);
    const target = n.kind === "target" ? targets.get(n.id) : undefined;
    const team = teams.get(element?.owner ?? target?.owner ?? "");
    return containers.has(n.id) ? drawContainer(c, n, box, team, target?.kind) : drawNode(c, n, box, element, team, ring, `clip-${clips++}`);
  };

  return [
    ...opening(width, height, c.ground, `${marker("arrow", c.edge)}${view.lens ? marker("arrow-faint", c["edge-faint"]) + marker("arrow-lit", c.ink) : ""}${brokerPattern(c)}`),
    text(PAD, 34, title, { size: 20, fill: c.ink }),
    text(PAD, 56, subtitle, { size: 12, fill: c.muted }),
    `<g transform="translate(${PAD},${HEADER})">`,
    ...byDepth.filter((n) => containers.has(n.id)).map(drawn),
    ...layout.edges.map((e) => drawEdge(c, e.points, view.edges.find((v) => v.from === e.from && v.to === e.to)!)),
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

/** A broker's vertical stripes, in the rule colour. */
const brokerPattern = (c: Palette) => `<pattern id="broker" width="12" height="12" patternUnits="userSpaceOnUse"><rect x="8" width="4" height="12" fill="${c.rule}"/></pattern>`;

/** A rectangle with its own radius per corner (top-left, top-right, bottom-right, bottom-left), as a path. */
function shape(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: [number, number, number, number]): string {
  const arc = (r: number, x2: number, y2: number) => (r ? `A${fmt(r)},${fmt(r)} 0 0 1 ${fmt(x2)},${fmt(y2)} ` : "");
  return (
    `M${fmt(x + tl)},${fmt(y)} L${fmt(x + w - tr)},${fmt(y)} ${arc(tr, x + w, y + tr)}` +
    `L${fmt(x + w)},${fmt(y + h - br)} ${arc(br, x + w - br, y + h)}` +
    `L${fmt(x + bl)},${fmt(y + h)} ${arc(bl, x, y + h - bl)}` +
    `L${fmt(x)},${fmt(y + tl)} ${arc(tl, x + tl, y)}Z`
  );
}

/** A reversed Team code tile with the Team colour as its leading band, its right edge at `right`. */
export function codeTile(c: Palette, team: TeamStyle, right: number, top: number): string {
  const w = textWidth(team.code, 10) + 16;
  const x = right - w;
  return [
    `<rect x="${fmt(x)}" y="${fmt(top)}" width="${fmt(w)}" height="16" fill="${c["code-bg"]}"/>`,
    `<rect x="${fmt(x)}" y="${fmt(top)}" width="5" height="16" fill="${team.color}"/>`,
    text(x + 10, top + 12, team.code, { size: 10, fill: c["code-fg"] }),
  ].join("");
}

/** How a node's Lens mark changes its frame, fill and text, as the viewer's `.arc-dim`, `.arc-side-*`, `.arc-hit` and `.arc-ringed` do. */
interface Look {
  frame: string;
  fill: string;
  name: string;
  sub: string;
  /** The left edge's colour: the Team's, unless the mark recolours the whole frame. */
  edge: string | undefined;
  /** A ring outside the frame: the lens origin's yellow, or the Team lens's Team colour. */
  ring?: string;
  /** Downstream's double frame. */
  double?: boolean;
}

function look(c: Palette, n: ViewNode, fill: string, team: TeamStyle | undefined, ringLens: boolean): Look {
  const plain: Look = { frame: c.ink, fill, name: c.ink, sub: c.muted, edge: team?.color ?? c.ink };
  const mark = n.mark;
  if (!mark) return plain;
  if (!mark.hit) return { frame: c.line, fill: c.ground, name: c.faint, sub: c.faint, edge: c.line };
  if (ringLens) return { ...plain, fill: c.paper, ring: team?.color ?? c.ink };
  if (mark.side === "origin") return { ...plain, fill: c.herebg, edge: c.ink, ring: c.here };
  if (mark.side === "upstream") return { ...plain, frame: c.up, fill: c.upbg, edge: c.up };
  if (mark.side === "downstream") return { ...plain, frame: c.down, fill: c.downbg, edge: c.down, double: true };
  return { ...plain, frame: c.path, fill: c.pathbg, edge: c.path };
}

/** An impact badge on a node's top edge: the origin, or the side and distance from it; a bare distance on a path lens. */
function badge(c: Palette, n: ViewNode, box: LaidOutNode): string[] {
  const mark = n.mark;
  if (mark?.distance === undefined) return [];
  const words = mark.side === "origin" ? "ORIGIN" : mark.side ? `${mark.side.toUpperCase()} ${mark.distance}` : String(mark.distance);
  const w = textWidth(words, 10) + 12;
  const x = box.x + box.width - 36 - w;
  const y = box.y - 10;
  const [fill, ink, frame] = mark.side === "origin" ? [c.here, c["on-here"], c.ink] : mark.side === "upstream" ? [c.up, c.paper, undefined] : mark.side === "downstream" ? [c.down, c.paper, undefined] : [c.paper, c.ink, c.ink];
  return [
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="16" fill="${fill}"${frame ? ` stroke="${frame}" stroke-width="${FRAME}"` : ""}/>`,
    text(x + 6, y + 12, words, { size: 10, fill: ink }),
  ];
}

function drawNode(c: Palette, n: ViewNode, box: LaidOutNode, element: BundleElement | undefined, team: TeamStyle | undefined, ringLens: boolean, clip: string): string {
  const { x, y, width: w, height: h } = box;
  const type = element?.kind === "service" ? element.type : undefined;
  const system = n.kind === "system";
  const l = look(c, n, system ? c.tint : c.paper, team, ringLens);
  const r = n.kind === "person" ? Math.min(36, h / 2) : 0;
  const d = shape(x, y, w, h, n.kind === "person" ? [r, r, r, r] : type === "datastore" ? [0, 0, 12, 12] : [0, 0, 0, 0]);
  const dash = n.external ? ` stroke-dasharray="6 4"` : "";
  const frameWidth = system ? 2 : FRAME;
  const tileWidth = team ? textWidth(team.code, 10) + 16 + 8 : 0;
  const left = x + EDGE + (n.kind === "person" ? 12 : 8);
  const right = n.kind === "person" ? x + w - 16 : x + w - 10;
  return [
    `<g>`,
    ...(l.ring ? [`<path d="${shape(x - 4, y - 4, w + 8, h + 8, r ? [r + 4, r + 4, r + 4, r + 4] : type === "datastore" ? [0, 0, 16, 16] : [0, 0, 0, 0])}" fill="${l.ring}"/>`] : []),
    `<clipPath id="${clip}"><path d="${d}"/></clipPath>`,
    `<path d="${d}" fill="${l.fill}"/>`,
    ...(type === "broker" ? [`<path d="${d}" fill="url(#broker)"/>`] : []),
    `<path d="${d}" fill="none" stroke="${l.frame}" stroke-width="${frameWidth}"${dash}/>`,
    ...(l.double ? [`<path d="${shape(x + 3, y + 3, w - 6, h - 6, [0, 0, type === "datastore" ? 9 : 0, type === "datastore" ? 9 : 0])}" fill="none" stroke="${l.frame}" stroke-width="${FRAME}"/>`] : []),
    `<rect x="${fmt(x - 1)}" y="${fmt(y - 1)}" width="${EDGE + 1}" height="${fmt(h + 2)}" fill="${l.edge}" clip-path="url(#${clip})"/>`,
    text(left, y + h / 2 - 4, cut(n.name, 13, right - left - tileWidth), { size: 13, fill: l.name }),
    text(left, y + h / 2 + 13, cut(subLabel(n, element), 11, right - left), { size: 11, fill: l.sub }),
    ...(team ? [codeTile(c, team, right, y + 8)] : []),
    ...badge(c, n, box),
    ...(n.mark?.hit && n.collapsed ? [`<rect x="${fmt(x + w - 42)}" y="${fmt(y + h - 18)}" width="10" height="10" fill="${c.ink}" stroke="${c.paper}" stroke-width="2"/>`] : []),
    `</g>`,
  ].join("");
}

/** An open box: a quiet line frame on the open-box tint, its head row at the top; a Deployment Target is a quiet frame with no fill. */
function drawContainer(c: Palette, n: ViewNode, box: LaidOutNode, team: TeamStyle | undefined, targetKind?: string): string {
  const { x, y, width: w, height: h } = box;
  const target = n.kind === "target";
  const dimmed = n.mark && !n.mark.hit;
  const frame = n.external ? c.ink : c.line;
  const fill = target || dimmed ? "none" : flatten(c.container, c.ground);
  const dash = n.external ? ` stroke-dasharray="6 4"` : "";
  const tileWidth = team ? textWidth(team.code, 10) + 16 + 8 : 0;
  const left = x + (target ? 12 : EDGE + 10);
  return [
    `<g>`,
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fill}" stroke="${frame}" stroke-width="${FRAME}"${dash}/>`,
    ...(target ? [] : [`<rect x="${fmt(x - FRAME / 2)}" y="${fmt(y - FRAME / 2)}" width="${EDGE}" height="${fmt(h + FRAME)}" fill="${frame}"/>`]),
    text(left, y + 22, cut(`${n.name} · ${targetKind ?? kindName(n)}`, 13, x + w - 10 - left - tileWidth), { size: 13, fill: dimmed ? c.faint : c.ink }),
    ...(team ? [codeTile(c, team, x + w - 10, y + 9)] : []),
    ...badge(c, n, box),
    `</g>`,
  ].join("");
}

/** A Relationship line: lit in ink by a Lens, stepped back to a solid fainter stroke when the Lens misses it. */
function drawEdge(c: Palette, points: { x: number; y: number }[], edge: ViewEdge): string {
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)},${fmt(p.y)}`).join(" ");
  if (edge.lit) return `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="2.5" marker-end="url(#arrow-lit)"/>`;
  if (edge.lit === false) return `<path d="${d}" fill="none" stroke="${c["edge-faint"]}" stroke-width="${FRAME}" marker-end="url(#arrow-faint)"/>`;
  return `<path d="${d}" fill="none" stroke="${c.edge}" stroke-width="${FRAME}" marker-end="url(#arrow)"/>`;
}

/** The key, in the canvas's own vocabulary: the Team tile, External, broker, and the Lens if there is one. */
function drawKey(c: Palette, lens: BundleLens | undefined): { parts: string[]; width: number } {
  const parts: string[] = [];
  let x = 0;
  const label = (s: string) => {
    parts.push(text(x, 16, s, { size: 11, fill: c.muted }));
    x += textWidth(s, 11) + 24;
  };
  const swatch = (attrs: string) => {
    parts.push(`<rect x="${fmt(x)}" y="4" width="28" height="16" ${attrs}/>`);
    x += 36;
  };
  parts.push(codeTile(c, { code: "ABC", color: c.muted }, x + textWidth("ABC", 10) + 16, 4));
  x += textWidth("ABC", 10) + 24;
  label("Team (stripe and code)");
  swatch(`fill="${c.paper}" stroke="${c.ink}" stroke-width="${FRAME}" stroke-dasharray="6 4"`);
  label("External");
  parts.push(`<rect x="${fmt(x)}" y="4" width="28" height="16" fill="${c.paper}"/><rect x="${fmt(x)}" y="4" width="28" height="16" fill="url(#broker)" stroke="${c.ink}" stroke-width="${FRAME}"/>`);
  x += 36;
  label("Broker");
  if (lens) {
    if ("impact" in lens) {
      swatch(`fill="${c.herebg}" stroke="${c.here}" stroke-width="2.5"`);
      label("Origin");
      swatch(`fill="${c.up}"`);
      label("Upstream");
      swatch(`fill="${c.down}"`);
      label("Downstream");
    } else if ("team" in lens) swatch(`fill="${c.paper}" stroke="${c.muted}" stroke-width="3"`);
    else swatch(`fill="${c.pathbg}" stroke="${c.path}" stroke-width="${FRAME}"`);
    label(`Lens: ${describeLens(lens)}`);
  }
  return { parts, width: x - 24 };
}

const kindName = (n: ViewNode) => ({ person: "Person", system: "System", service: "Service", component: "Component", target: "Deployment Target", deployment: "Deployment" })[n.kind];

/** The line under a node's name: External, its kind (or Service type), and its technology. */
function subLabel(n: ViewNode, element: BundleElement | undefined): string {
  const type = n.kind !== "deployment" && element?.kind === "service" && element.type !== "app" ? { datastore: "Datastore", broker: "Broker" }[element.type] : kindName(n);
  const technology = element && "technology" in element ? element.technology : null;
  return [`${n.external ? "External " : ""}${type}`, ...(technology ? [technology] : [])].join(" · ");
}
