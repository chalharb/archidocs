import type { ResolvedDynamicView, ResolvedStep } from "../core/views/index.ts";
import { textWidth } from "./text.ts";

/** How a message is drawn: sync is solid with a filled head, async solid with an open head, return dashed with an open head. */
export type MessageStyle = "sync" | "async" | "return";

/**
 * One arrow of a sequence chart: a whole Step, or with brokers shown one leg
 * of an event Step. `key` is the Step's number, or `na` / `nb` for the
 * publish and deliver legs; both legs keep the Step's `n`.
 */
export interface SequenceMessage {
  key: string;
  n: number;
  leg?: "a" | "b";
  from: string;
  to: string;
  style: MessageStyle;
  /** The Step's description. */
  label: string;
  /** For an event Step: the broker it runs via, and its channel. */
  via?: string;
  channel?: string;
  note?: string;
  step: ResolvedStep;
}

/** Sizes the sequence layout works in, shared by the renderer and the viewer. */
export const SEQUENCE = {
  /** Height of the participant headers at the top. */
  header: 60,
  /** Gap between the top of the first row and the headers. */
  firstRow: 34,
  /** Least space between two neighbouring headers. */
  columnGap: 40,
  /** Space beside a label inside its arrow's span: the badge and the gaps. */
  labelPad: 56,
  rowHeight: 46,
  /** Extra height for each line under an arrow (the via line, the note). */
  lineHeight: 16,
  /** Activation bar width. */
  bar: 10,
  nameSize: 13,
  labelSize: 12,
  subSize: 11,
  /** Room in a header beside its name: the Team stripe, code and padding. */
  headerPad: 64,
  minColumn: 116,
  maxColumn: 200,
  margin: 24,
} as const;

export interface SequenceColumn {
  id: string;
  /** The lifeline's x. */
  x: number;
  /** The header's width. */
  width: number;
}

export interface SequenceRow extends SequenceMessage {
  /** Top of the row's band. */
  top: number;
  /** The arrow's y. */
  y: number;
  height: number;
  /** Where the arrow starts (at `from`) and ends (at `to`), on a lifeline or the edge of an activation bar. */
  x1: number;
  x2: number;
  /** The widest line of the label, at its size. */
  labelWidth: number;
}

/** A participant busy with a sync call, from the call's arrow to its return's; `depth` counts the bars it nests in. */
export interface Activation {
  participant: string;
  top: number;
  bottom: number;
  depth: number;
}

export interface SequenceLayout {
  columns: SequenceColumn[];
  rows: SequenceRow[];
  activations: Activation[];
  width: number;
  height: number;
}

export interface SequenceOptions {
  /** Shows each event Step as two legs through its broker's lifeline. */
  brokers?: boolean;
}

/**
 * The arrows of a Dynamic View in order: one per Step, or with `brokers` a
 * publish leg `na` (publisher → broker) and a deliver leg `nb` (broker →
 * subscriber) per event Step. A fan-out's publish legs aren't merged.
 */
export function sequenceMessages(view: ResolvedDynamicView, { brokers = false }: SequenceOptions = {}): SequenceMessage[] {
  return view.steps.flatMap((step): SequenceMessage[] => {
    const base = {
      n: step.n,
      label: step.description,
      ...(step.via === undefined ? {} : { via: step.via }),
      ...(step.channel === undefined ? {} : { channel: step.channel }),
      ...(step.note === undefined ? {} : { note: step.note }),
      step,
    };
    const style: MessageStyle = step.kind === "return" ? "return" : step.interaction;
    if (!brokers || step.kind !== "event" || step.via === undefined) return [{ ...base, key: String(step.n), from: step.from, to: step.to, style }];
    return [
      { ...base, key: `${step.n}a`, leg: "a", from: step.from, to: step.via, style },
      { ...base, key: `${step.n}b`, leg: "b", from: step.via, to: step.to, style },
    ];
  });
}

/** The participants as columns: with brokers, each broker not already a participant goes right after the publisher of its first event Step. */
export function sequenceParticipants(view: ResolvedDynamicView, { brokers = false }: SequenceOptions = {}): string[] {
  const ids = [...view.participants];
  if (!brokers) return ids;
  for (const step of view.steps) {
    if (step.kind !== "event" || step.via === undefined || ids.includes(step.via)) continue;
    ids.splice(ids.indexOf(step.from) + 1, 0, step.via);
  }
  return ids;
}

/** The text under an arrow: the broker and channel of an event Step drawn whole. */
export const viaLine = (m: SequenceMessage, name: (id: string) => string): string | undefined =>
  m.via === undefined || m.leg !== undefined ? undefined : ["via " + name(m.via), ...(m.channel === undefined ? [] : [m.channel])].join(" · ");

/**
 * Lays out a Dynamic View as a sequence chart, as a pure function: one row
 * per message, one column per participant in order, and each lifeline's x
 * from one longest-path pass over lower bounds (its left neighbour's header,
 * and the label of each arrow that ends at it), so no solver is needed.
 */
export function layoutSequence(view: ResolvedDynamicView, options: SequenceOptions & { name: (id: string) => string }): SequenceLayout {
  const S = SEQUENCE;
  const messages = sequenceMessages(view, options);
  const ids = sequenceParticipants(view, options);
  const index = new Map(ids.map((id, i) => [id, i]));
  const widths = ids.map((id) => Math.min(S.maxColumn, Math.max(S.minColumn, textWidth(options.name(id), S.nameSize, 700) + S.headerPad)));

  const labelWidths = messages.map((m) => {
    const via = viaLine(m, options.name);
    return Math.max(textWidth(m.label, S.labelSize), via ? textWidth(via, S.subSize) : 0, m.note ? textWidth(m.note, S.subSize) : 0);
  });
  // Lower bounds on each column's x from the arrows ending at it, keyed by the right-hand column.
  const bounds: { left: number; gap: number }[][] = ids.map(() => []);
  messages.forEach((m, i) => {
    const [a, b] = [index.get(m.from)!, index.get(m.to)!];
    if (a !== b) bounds[Math.max(a, b)]!.push({ left: Math.min(a, b), gap: labelWidths[i]! + S.labelPad });
  });
  const xs: number[] = [];
  ids.forEach((_, j) => {
    let x = j === 0 ? S.margin + widths[0]! / 2 : xs[j - 1]! + widths[j - 1]! / 2 + widths[j]! / 2 + S.columnGap;
    for (const b of bounds[j]!) x = Math.max(x, xs[b.left]! + b.gap);
    xs.push(x);
  });
  const columns = ids.map((id, i) => ({ id, x: xs[i]!, width: widths[i]! }));

  // y: one band per message, taller for each line under the arrow.
  let cursor = S.header + S.firstRow;
  const bands = messages.map((m) => {
    const lines = (viaLine(m, options.name) ? 1 : 0) + (m.note ? 1 : 0);
    const band = { top: cursor, y: cursor + 26, height: S.rowHeight + lines * S.lineHeight };
    cursor += band.height;
    return band;
  });

  // Activation bars: a sync call opens one on its callee; the return from it closes the latest still open.
  const open = new Map<string, { top: number; depth: number }[]>();
  const activations: Activation[] = [];
  const lastSend = new Map<string, number>();
  messages.forEach((m, i) => lastSend.set(m.from, bands[i]!.y));
  messages.forEach((m, i) => {
    const y = bands[i]!.y;
    if (m.style === "return") {
      const bar = open.get(m.from)?.pop();
      if (bar) activations.push({ participant: m.from, top: bar.top, bottom: y, depth: bar.depth });
    } else if (m.style === "sync") {
      const stack = open.get(m.to) ?? [];
      stack.push({ top: y, depth: stack.length });
      open.set(m.to, stack);
    }
  });
  // A call never returned stays busy until the callee's last send, and at least a short stub.
  for (const [participant, stack] of open)
    for (const bar of stack) activations.push({ participant, top: bar.top, bottom: Math.max(bar.top + 18, lastSend.get(participant) ?? 0), depth: bar.depth });
  activations.sort((a, b) => a.top - b.top || a.participant.localeCompare(b.participant));

  /** Where an arrow meets a participant at y: the edge of its deepest open bar on the arrow's side, else its lifeline. */
  const edgeAt = (id: string, y: number, side: "left" | "right") => {
    const x = xs[index.get(id)!]!;
    const busy = activations.filter((a) => a.participant === id && a.top <= y && y <= a.bottom);
    if (busy.length === 0) return x;
    const depth = Math.max(...busy.map((a) => a.depth));
    return side === "left" ? x - S.bar / 2 : x + S.bar / 2 + (depth * S.bar) / 2;
  };

  const rows = messages.map((m, i): SequenceRow => {
    const { top, y, height } = bands[i]!;
    const rightward = xs[index.get(m.to)!]! > xs[index.get(m.from)!]!;
    return { ...m, top, y, height, x1: edgeAt(m.from, y, rightward ? "right" : "left"), x2: edgeAt(m.to, y, rightward ? "left" : "right"), labelWidth: labelWidths[i]! };
  });

  const last = columns.at(-1);
  return { columns, rows, activations, width: last ? last.x + last.width / 2 + S.margin : 2 * S.margin, height: cursor + 30 };
}
