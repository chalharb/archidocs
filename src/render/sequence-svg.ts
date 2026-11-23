import type { ResolvedDynamicView } from "../core/dynamic-views.ts";
import type { Bundle, BundleElement } from "../schema/bundle.ts";
import { FONT_BASE64, FONT_FAMILY } from "./font.ts";
import { layoutSequence, SEQUENCE, viaLine, type MessageStyle, type SequenceLayout, type SequenceRow } from "./sequence.ts";
import type { RenderSource } from "./svg.ts";
import { teamStyles } from "./teams.ts";
import { cut, fmt, text, textWidth } from "./text.ts";

export interface SequenceRenderInput {
  /** The Bundle the View was resolved from: it gives each participant's name and Team. */
  bundle: Bundle;
  view: ResolvedDynamicView;
  source: RenderSource;
  /** Draws each event Step as a publish and a deliver leg through its broker. */
  brokers?: boolean;
}

const PAD = 24;
const TITLE = 72;
const KEY = 44;
/** The header box's height; its lifeline runs down from its bottom. */
export const HEADER_BOX = 44;

const COLOR = { background: "#ffffff", ink: "#1b2330", muted: "#5b6573", border: "#8a94a3", node: "#ffffff", bar: "#eef1f5", edge: "#3d4654", badge: "#1b2330" };

/** How each style is drawn: its dash pattern and arrowhead. */
export const ARROW: Record<MessageStyle, { dash: string | null; head: "filled" | "open" }> = {
  sync: { dash: null, head: "filled" },
  async: { dash: null, head: "open" },
  return: { dash: "6 4", head: "open" },
};

/**
 * Draws a Dynamic View as a sequence chart in one SVG document: title and
 * source line, participant headers with their lifelines and activation bars,
 * one numbered arrow per Step (or leg), and a key. Pure, like `renderSvg`,
 * and laid out by the same `layoutSequence` the viewer uses.
 */
export function renderSequenceSvg({ bundle, view, source, brokers = false }: SequenceRenderInput): string {
  const elements = new Map(bundle.elements.map((e) => [e.id, e]));
  const name = (id: string) => elements.get(id)?.name ?? id;
  const layout = layoutSequence(view, { name, brokers });
  const teams = teamStyles(bundle);

  const sourceLine = [source.workspace, source.commit?.slice(0, 7) ?? "uncommitted", ...(source.date ? [source.date.slice(0, 10)] : [])].join(" · ");
  const key = drawKey();
  const width = Math.ceil(Math.max(layout.width, key.width, textWidth(view.title, 20), textWidth(sourceLine, 12)) + 2 * PAD);
  const height = Math.ceil(TITLE + layout.height + KEY);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY}, sans-serif">`,
    `<style>@font-face{font-family:"${FONT_FAMILY}";src:url(data:font/ttf;base64,${FONT_BASE64}) format("truetype")}</style>`,
    `<defs>${heads(COLOR.edge)}</defs>`,
    `<rect width="${width}" height="${height}" fill="${COLOR.background}"/>`,
    text(PAD, 34, view.title, { size: 20, fill: COLOR.ink }),
    text(PAD, 56, sourceLine, { size: 12, fill: COLOR.muted }),
    `<g transform="translate(${PAD},${TITLE})">`,
    ...layout.columns.map((c) => lifeline(c.x, layout)),
    ...layout.activations.map((a) => {
      const x = layout.columns.find((c) => c.id === a.participant)!.x - SEQUENCE.bar / 2 + (a.depth * SEQUENCE.bar) / 2;
      return `<rect x="${fmt(x)}" y="${fmt(a.top - 6)}" width="${SEQUENCE.bar}" height="${fmt(a.bottom - a.top + 12)}" fill="${COLOR.bar}" stroke="${COLOR.border}"/>`;
    }),
    ...layout.columns.map((c) => header(c.id, c.x, c.width, elements.get(c.id), teams.get(elements.get(c.id)?.owner ?? "")?.color)),
    ...layout.rows.map((r) => arrow(r, name)),
    `</g>`,
    `<g transform="translate(${PAD},${fmt(TITLE + layout.height)})">`,
    ...key.parts,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n");
}

/** Arrowheads: filled for sync calls, open for async and returns. */
export const heads = (fill: string) =>
  `<marker id="head-filled" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${fill}"/></marker>` +
  `<marker id="head-open" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="${fill}" stroke-width="1.5"/></marker>`;

const lifeline = (x: number, layout: SequenceLayout) =>
  `<path d="M${fmt(x)},${HEADER_BOX} L${fmt(x)},${fmt(layout.height - 10)}" fill="none" stroke="${COLOR.border}" stroke-dasharray="3 4"/>`;

function header(id: string, x: number, w: number, element: BundleElement | undefined, team: string | undefined): string {
  const left = x - w / 2;
  const name = element?.name ?? id;
  const dash = element && "external" in element && element.external ? ` stroke-dasharray="6 4"` : "";
  return [
    `<g>`,
    `<rect x="${fmt(left)}" y="0" width="${fmt(w)}" height="${HEADER_BOX}" rx="8" fill="${COLOR.node}" stroke="${COLOR.border}" stroke-width="1.25"${dash}/>`,
    ...(team ? [`<rect x="${fmt(left + 1)}" y="1" width="5" height="${HEADER_BOX - 2}" fill="${team}"/>`] : []),
    text(left + 14, 27, cut(name, SEQUENCE.nameSize, w - 22), { size: SEQUENCE.nameSize, fill: COLOR.ink }),
    `</g>`,
  ].join("");
}

function arrow(r: SequenceRow, name: (id: string) => string): string {
  const { dash, head } = ARROW[r.style];
  const way = r.x2 >= r.x1 ? 1 : -1;
  const badgeX = r.x1 + way * 14;
  const labelX = r.x1 + way * 28;
  const anchor = way > 0 ? undefined : ("end" as const);
  const under = [viaLine(r, name), r.note].filter((s): s is string => s !== undefined);
  return [
    `<path data-step="${r.key}" d="M${fmt(r.x1)},${fmt(r.y)} L${fmt(r.x2)},${fmt(r.y)}" fill="none" stroke="${COLOR.edge}" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#head-${head})"/>`,
    `<circle cx="${fmt(badgeX)}" cy="${fmt(r.y)}" r="9" fill="${COLOR.badge}"/>`,
    text(badgeX, r.y + 3.5, r.key, { size: r.key.length > 2 ? 8 : 10, fill: COLOR.background, anchor: "middle" }),
    text(labelX, r.y - 7, r.label, { size: SEQUENCE.labelSize, fill: COLOR.ink, ...(anchor ? { anchor } : {}) }),
    ...under.map((s, i) => text(labelX, r.y + 16 + i * SEQUENCE.lineHeight, s, { size: SEQUENCE.subSize, fill: COLOR.muted, ...(anchor ? { anchor } : {}) })),
  ].join("");
}

/** The key: what each arrow style means. */
function drawKey(): { parts: string[]; width: number } {
  const parts: string[] = [];
  let x = 0;
  for (const [label, style] of [["Sync call", "sync"], ["Async", "async"], ["Return", "return"]] as const) {
    const { dash, head } = ARROW[style];
    parts.push(`<path d="M${x},12 L${x + 32},12" fill="none" stroke="${COLOR.edge}" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#head-${head})"/>`);
    x += 40;
    parts.push(text(x, 16, label, { size: 11, fill: COLOR.muted }));
    x += textWidth(label, 11) + 24;
  }
  return { parts, width: x - 24 };
}
