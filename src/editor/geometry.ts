/**
 * Pure geometry for the layout editor: snapping (LAYOUT-03), alignment and
 * distribution (LAYOUT-02), bounds, and floating edge endpoints.
 */
import type { Box } from "@/domain/layout/positions";

export type { Box };

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

export function snap(value: number, grid: number): number {
  if (grid <= 0) return value;
  const r = Math.round(value / grid) * grid;
  return Object.is(r, -0) ? 0 : r;
}

export function snapPoint(p: { x: number; y: number }, grid: number) {
  return { x: snap(p.x, grid), y: snap(p.y, grid) };
}

export function bounds(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** New top-left positions that align the given boxes (LAYOUT-02). */
export function align(
  boxes: Readonly<Record<string, Box>>,
  ids: readonly string[],
  mode: AlignMode,
): Record<string, { x: number; y: number }> {
  const selected = ids.filter((id) => boxes[id]).map((id) => [id, boxes[id]!] as const);
  if (selected.length < 2) return {};
  const b = bounds(selected.map(([, box]) => box))!;
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, box] of selected) {
    let { x, y } = box;
    switch (mode) {
      case "left":
        x = b.x;
        break;
      case "center":
        x = b.x + b.width / 2 - box.width / 2;
        break;
      case "right":
        x = b.x + b.width - box.width;
        break;
      case "top":
        y = b.y;
        break;
      case "middle":
        y = b.y + b.height / 2 - box.height / 2;
        break;
      case "bottom":
        y = b.y + b.height - box.height;
        break;
    }
    out[id] = { x, y };
  }
  return out;
}

/**
 * Spread boxes so the gaps between them are equal (LAYOUT-02). The first and
 * last box along the axis stay where they are. Ties are broken by ID so the
 * result is deterministic.
 */
export function distribute(
  boxes: Readonly<Record<string, Box>>,
  ids: readonly string[],
  axis: DistributeAxis,
): Record<string, { x: number; y: number }> {
  const selected = ids.filter((id) => boxes[id]).map((id) => [id, boxes[id]!] as const);
  if (selected.length < 3) return {};
  const pos = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  selected.sort((a, b) => a[1][pos] - b[1][pos] || (a[0] < b[0] ? -1 : 1));
  const first = selected[0]![1];
  const last = selected[selected.length - 1]![1];
  const span = last[pos] + last[size] - first[pos];
  const occupied = selected.reduce((sum, [, b]) => sum + b[size], 0);
  const gap = (span - occupied) / (selected.length - 1);
  const out: Record<string, { x: number; y: number }> = {};
  let cursor = first[pos];
  for (const [id, box] of selected) {
    out[id] = { x: box.x, y: box.y, [pos]: cursor };
    cursor += box[size] + gap;
  }
  return out;
}

export type Side = "top" | "right" | "bottom" | "left";

/**
 * Where the line from the centre of `from` towards the centre of `to` leaves
 * `from`'s border, and which side that is. Used for floating edges, which
 * connect boxes wherever they are placed.
 */
export function borderPoint(from: Box, to: Box): { x: number; y: number; side: Side } {
  const cx = from.x + from.width / 2;
  const cy = from.y + from.height / 2;
  const dx = to.x + to.width / 2 - cx;
  const dy = to.y + to.height / 2 - cy;
  const hw = from.width / 2;
  const hh = from.height / 2;
  if (dx === 0 && dy === 0) return { x: cx, y: from.y + from.height, side: "bottom" };
  const scale = Math.min(
    dx !== 0 ? hw / Math.abs(dx) : Infinity,
    dy !== 0 ? hh / Math.abs(dy) : Infinity,
  );
  const x = cx + dx * scale;
  const y = cy + dy * scale;
  const side: Side =
    Math.abs(dx) * hh >= Math.abs(dy) * hw
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "bottom"
        : "top";
  return { x, y, side };
}

/** True when `inner` lies entirely inside `outer`. */
export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
