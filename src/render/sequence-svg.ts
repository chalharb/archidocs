import type { ResolvedDynamicView } from "../core/views/index.ts";
import type { Bundle, BundleElement } from "../schema/bundle.ts";
import { layoutSequence, SEQUENCE, viaLine, type MessageStyle, type SequenceLayout, type SequenceRow } from "./sequence.ts";
import { codeTile, opening, sourceLine, type RenderSource } from "./svg.ts";
import { teamStyles, type TeamStyle } from "./teams.ts";
import { cut, fmt, text, textWidth } from "./text.ts";
import { PALETTES, type Palette, type Theme } from "./tokens.ts";

export interface SequenceRenderInput {
  /** The Bundle the View was resolved from: it gives each participant's name and Team. */
  bundle: Bundle;
  view: ResolvedDynamicView;
  source: RenderSource;
  /** Draws each event Step as a publish and a deliver leg through its broker. */
  brokers?: boolean;
  /** The palette: the viewer's light tokens (the default) or its Night shift dark ones. */
  theme?: Theme;
  /** Replaces the source line under the title, such as `Big Bank · v1.2.0`. */
  label?: string;
}

const PAD = 24;
const TITLE = 72;
const KEY = 44;
/** The header box's height; its lifeline runs down from its bottom. */
export const HEADER_BOX = 44;

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
export function renderSequenceSvg({ bundle, view, source, brokers = false, theme = "light", label }: SequenceRenderInput): string {
  const c = PALETTES[theme];
  const elements = new Map(bundle.elements.map((e) => [e.id, e]));
  const name = (id: string) => elements.get(id)?.name ?? id;
  const layout = layoutSequence(view, { name, brokers });
  const teams = teamStyles(bundle);

  const subtitle = sourceLine(source, label);
  const key = drawKey(c);
  const width = Math.ceil(Math.max(layout.width, key.width, textWidth(view.title, 20, 700), textWidth(subtitle, 12)) + 2 * PAD);
  const height = Math.ceil(TITLE + layout.height + KEY);

  return [
    ...opening(width, height, c.ground, heads(c.ink)),
    text(PAD, 34, view.title, { size: 20, fill: c.ink, weight: 700 }),
    text(PAD, 56, subtitle, { size: 12, fill: c.muted }),
    `<g transform="translate(${PAD},${TITLE})">`,
    ...layout.columns.map((col) => lifeline(c, col.x, layout)),
    ...layout.activations.map((a) => {
      const x = layout.columns.find((col) => col.id === a.participant)!.x - SEQUENCE.bar / 2 + (a.depth * SEQUENCE.bar) / 2;
      return `<rect x="${fmt(x)}" y="${fmt(a.top - 6)}" width="${SEQUENCE.bar}" height="${fmt(a.bottom - a.top + 12)}" fill="${c.tint}" stroke="${c.faint}"/>`;
    }),
    ...layout.columns.map((col) => header(c, col.id, col.x, col.width, elements.get(col.id), teams.get(elements.get(col.id)?.owner ?? ""))),
    ...layout.rows.map((r) => arrow(c, r, name)),
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
  `<marker id="head-filled" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${fill}"/></marker>` +
  `<marker id="head-open" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="${fill}" stroke-width="1.5"/></marker>`;

const lifeline = (c: Palette, x: number, layout: SequenceLayout) =>
  `<path d="M${fmt(x)},${HEADER_BOX} L${fmt(x)},${fmt(layout.height - 10)}" fill="none" stroke="${c.faint}" stroke-dasharray="3 4"/>`;

function header(c: Palette, id: string, x: number, w: number, element: BundleElement | undefined, team: TeamStyle | undefined): string {
  const left = x - w / 2;
  const name = element?.name ?? id;
  const external = element !== undefined && "external" in element && element.external;
  // The code tile sits 6px in from the right, 4px clear of the name; `SEQUENCE.headerPad` budgets for both.
  const tileWidth = team ? textWidth(team.code, 10, 700) + 16 + 4 : 0;
  return [
    `<g>`,
    `<rect x="${fmt(left)}" y="0" width="${fmt(w)}" height="${HEADER_BOX}" fill="${external ? c.ground : c.paper}" stroke="${c.ink}" stroke-width="1.5"${external ? ` stroke-dasharray="6 4"` : ""}/>`,
    text(left + 14, 27, cut(name, SEQUENCE.nameSize, w - 20 - tileWidth, 700), { size: SEQUENCE.nameSize, fill: c.ink, weight: 700 }),
    ...(team ? [codeTile(c, team, left + w - 6, HEADER_BOX / 2 - 8)] : []),
    `</g>`,
  ].join("");
}

function arrow(c: Palette, r: SequenceRow, name: (id: string) => string): string {
  const { dash, head } = ARROW[r.style];
  const way = r.x2 >= r.x1 ? 1 : -1;
  const badgeX = r.x1 + way * 14;
  const labelX = r.x1 + way * 28;
  const anchor = way > 0 ? undefined : ("end" as const);
  const under = [viaLine(r, name), r.note].filter((s): s is string => s !== undefined);
  return [
    `<path data-step="${r.key}" d="M${fmt(r.x1)},${fmt(r.y)} L${fmt(r.x2)},${fmt(r.y)}" fill="none" stroke="${c.ink}" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#head-${head})"/>`,
    `<circle cx="${fmt(badgeX)}" cy="${fmt(r.y)}" r="9" fill="${c.ink}"/>`,
    text(badgeX, r.y + 3.5, r.key, { size: r.key.length > 2 ? 8 : 10, fill: c.paper, anchor: "middle", weight: 700 }),
    text(labelX, r.y - 7, r.label, { size: SEQUENCE.labelSize, fill: c.ink, ...(anchor ? { anchor } : {}) }),
    ...under.map((s, i) => text(labelX, r.y + 16 + i * SEQUENCE.lineHeight, s, { size: SEQUENCE.subSize, fill: c.muted, ...(anchor ? { anchor } : {}) })),
  ].join("");
}

/** The key: what each arrow style means. */
function drawKey(c: Palette): { parts: string[]; width: number } {
  const parts: string[] = [];
  let x = 0;
  for (const [label, style] of [["Sync call", "sync"], ["Async", "async"], ["Return", "return"]] as const) {
    const { dash, head } = ARROW[style];
    parts.push(`<path d="M${x},12 L${x + 32},12" fill="none" stroke="${c.ink}" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#head-${head})"/>`);
    x += 40;
    parts.push(text(x, 16, label, { size: 11, fill: c.muted }));
    x += textWidth(label, 11) + 24;
  }
  return { parts, width: x - 24 };
}
