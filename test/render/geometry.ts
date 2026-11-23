import type { Layout } from "../../src/render/index.ts";

type Point = { x: number; y: number };
type Box = { id: string; x: number; y: number; width: number; height: number };

const EPS = 0.5;

/**
 * The auto-layout definition as checks over laid-out geometry, each returning
 * the offending items: boxes that overlap (other than a container and what is
 * inside it), edge segments that run through a box other than their own ends
 * and those ends' containers, diagonal segments, and edges whose ends don't
 * sit on their nodes' borders.
 */
export function layoutProblems(layout: Layout) {
  const boxes = new Map(layout.nodes.map((n) => [n.id, n]));
  const ancestors = (id: string): string[] => {
    const parent = boxes.get(id)?.parent;
    return parent ? [parent, ...ancestors(parent)] : [];
  };
  const overlaps: string[] = [];
  for (const [i, a] of layout.nodes.entries())
    for (const b of layout.nodes.slice(i + 1)) {
      if (ancestors(a.id).includes(b.id) || ancestors(b.id).includes(a.id)) continue;
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ox > EPS && oy > EPS) overlaps.push(`${a.id} × ${b.id}`);
    }
  const throughNodes: string[] = [];
  const diagonal: string[] = [];
  const detached: string[] = [];
  for (const e of layout.edges) {
    const name = `${e.from} → ${e.to}`;
    const allowed = new Set([e.from, e.to, ...ancestors(e.from), ...ancestors(e.to)]);
    const [first, last] = [e.points[0], e.points.at(-1)];
    if (!first || !last || e.points.length < 2 || !onBorder(first, boxes.get(e.from)!) || !onBorder(last, boxes.get(e.to)!)) detached.push(name);
    for (const [k, a] of e.points.slice(0, -1).entries()) {
      const b = e.points[k + 1]!;
      if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) diagonal.push(name);
      for (const box of layout.nodes) if (!allowed.has(box.id) && crosses(a, b, box)) throughNodes.push(`${name} through ${box.id}`);
    }
  }
  return { overlaps, throughNodes, diagonal: [...new Set(diagonal)], detached };
}

/** An axis-aligned segment that enters a box's interior. */
function crosses(a: Point, b: Point, r: Box): boolean {
  const [x1, y1, x2, y2] = [r.x + 1, r.y + 1, r.x + r.width - 1, r.y + r.height - 1];
  return Math.max(a.x, b.x) > x1 && Math.min(a.x, b.x) < x2 && Math.max(a.y, b.y) > y1 && Math.min(a.y, b.y) < y2;
}

function onBorder(p: Point, r: Box, tolerance = 2): boolean {
  const inX = p.x >= r.x - tolerance && p.x <= r.x + r.width + tolerance;
  const inY = p.y >= r.y - tolerance && p.y <= r.y + r.height + tolerance;
  const nearV = Math.abs(p.x - r.x) <= tolerance || Math.abs(p.x - r.x - r.width) <= tolerance;
  const nearH = Math.abs(p.y - r.y) <= tolerance || Math.abs(p.y - r.y - r.height) <= tolerance;
  return (inX && nearH) || (inY && nearV);
}
