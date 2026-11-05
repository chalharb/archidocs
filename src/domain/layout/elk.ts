/**
 * Automatic layout with ELK.js (LAYOUT-04/05/06, LAYOUT-14, LAYOUT-21, LAYOUT-24).
 *
 * - Layered algorithm; direction and node/layer spacing come from the resolved
 *   layout settings.
 * - Nodes inside a boundary (LAYOUT-14) become ELK child nodes, so boundaries
 *   are sized to fit their contents. Output coordinates are absolute canvas
 *   coordinates, like everything stored in `.layout.yaml` (ADD-006).
 * - Deterministic (LAYOUT-21): identical input, settings and the pinned ELK
 *   version (see package.json) give identical positions. Model order is kept
 *   and the random seed is fixed.
 * - Partial regeneration (LAYOUT-24): only nodes without a manual position are
 *   placed; when a generated box would overlap a manual one it is moved to the
 *   nearest free grid slot. Manual positions are never changed.
 */
import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { ResolvedEdge, ResolvedNode } from "../diagram-resolve";
import type { LayoutSettings } from "../resources";
import {
  overlaps,
  type AsyncPositionGenerator,
  type Box,
  type GeneratedPosition,
  type GeneratorInput,
} from "./positions";

/** Space reserved inside a boundary for its title, and around its contents. */
export const BOUNDARY_PADDING = { top: 56, left: 24, bottom: 24, right: 24 } as const;

let engine: InstanceType<typeof ELK> | null = null;
function elk(): InstanceType<typeof ELK> {
  engine ??= new ELK();
  return engine;
}

export interface FullLayoutInput {
  nodes: readonly ResolvedNode[];
  edges: readonly ResolvedEdge[];
  settings: LayoutSettings;
  /** Sizes to use for leaf nodes (e.g. manual sizes); defaults to the settings. */
  sizes?: Readonly<Record<string, { width: number; height: number }>>;
}

function layoutOptions(settings: LayoutSettings): Record<string, string> {
  return {
    "elk.algorithm": "layered",
    "elk.direction": settings.direction,
    "elk.spacing.nodeNode": String(settings.nodeSpacing),
    "elk.layered.spacing.nodeNodeBetweenLayers": String(settings.layerSpacing),
    "elk.spacing.edgeNode": String(Math.max(10, settings.nodeSpacing / 2)),
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "elk.randomSeed": "1",
    "elk.separateConnectedComponents": "false",
  };
}

/** The boundary chain of a node, nearest first. Cycle-safe. */
function boundaryChain(byId: Map<string, ResolvedNode>, id: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([id]);
  let current = byId.get(id)?.boundary;
  while (current !== undefined && byId.has(current) && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = byId.get(current)!.boundary;
  }
  return chain;
}

/** Lay out every node from scratch (Re-layout All, LAYOUT-12/20). */
export async function layoutAll(
  input: FullLayoutInput,
): Promise<Record<string, Required<GeneratedPosition>>> {
  const { nodes, edges, settings } = input;
  if (nodes.length === 0) return {};
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = new Map<string, string | undefined>();
  for (const n of nodes) parentOf.set(n.id, boundaryChain(byId, n.id)[0]);

  const elkNodes = new Map<string, ElkNode>();
  for (const n of nodes) {
    const size = input.sizes?.[n.id];
    elkNodes.set(n.id, {
      id: n.id,
      width: size?.width ?? settings.nodeWidth,
      height: size?.height ?? settings.nodeHeight,
    });
  }
  const root: ElkNode = { id: "__root__", layoutOptions: layoutOptions(settings), children: [] };
  for (const n of nodes) {
    const parent = parentOf.get(n.id);
    const container = parent !== undefined ? elkNodes.get(parent)! : root;
    if (container !== root) {
      container.layoutOptions ??= {
        "elk.padding": `[top=${BOUNDARY_PADDING.top},left=${BOUNDARY_PADDING.left},bottom=${BOUNDARY_PADDING.bottom},right=${BOUNDARY_PADDING.right}]`,
        "elk.nodeSize.constraints": "MINIMUM_SIZE",
        "elk.nodeSize.minimum": `(${settings.nodeWidth},${settings.nodeHeight})`,
      };
    }
    (container.children ??= []).push(elkNodes.get(n.id)!);
  }
  // Boundaries are sized by ELK, not fixed.
  for (const n of nodes) {
    const el = elkNodes.get(n.id)!;
    if (el.children?.length) {
      delete el.width;
      delete el.height;
    }
  }

  const elkEdges: ElkExtendedEdge[] = [];
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    // An edge between a boundary and its own contents cannot be routed by ELK.
    if (boundaryChain(byId, e.source).includes(e.target)) continue;
    if (boundaryChain(byId, e.target).includes(e.source)) continue;
    elkEdges.push({ id: e.id, sources: [e.source], targets: [e.target] });
  }
  root.edges = elkEdges;

  const laidOut = await elk().layout(root);
  const out: Record<string, Required<GeneratedPosition>> = {};
  const visit = (node: ElkNode, offsetX: number, offsetY: number) => {
    for (const child of node.children ?? []) {
      const x = offsetX + (child.x ?? 0);
      const y = offsetY + (child.y ?? 0);
      out[child.id] = {
        x: round(x),
        y: round(y),
        width: round(child.width ?? settings.nodeWidth),
        height: round(child.height ?? settings.nodeHeight),
      };
      visit(child, x, y);
    }
  };
  visit(laidOut, 0, 0);
  return out;
}

function round(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Move `box` to the nearest grid slot that overlaps none of `taken`.
 * Deterministic: slots are tried in rings of increasing distance, in a fixed order.
 */
export function nearestFreeSlot(box: Box, taken: readonly Box[], step: number, maxRings = 50): Box {
  if (!taken.some((t) => overlaps(t, box))) return box;
  const sx = Math.max(step, box.width / 2);
  const sy = Math.max(step, box.height / 2);
  for (let ring = 1; ring <= maxRings; ring++) {
    const candidates: Array<[number, number]> = [];
    for (let dx = -ring; dx <= ring; dx++)
      for (let dy = -ring; dy <= ring; dy++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) candidates.push([dx, dy]);
    candidates.sort(
      (a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[1] - b[1] || a[0] - b[0],
    );
    for (const [dx, dy] of candidates) {
      const moved = { ...box, x: box.x + dx * sx, y: box.y + dy * sy };
      if (!taken.some((t) => overlaps(t, moved))) return moved;
    }
  }
  return box; // unresolved; the caller reports the collision
}

const cache = new Map<string, Record<string, Required<GeneratedPosition>>>();
const CACHE_LIMIT = 64;

/** Memoized `layoutAll`; the input fully determines the output (LAYOUT-21). */
async function layoutAllCached(input: FullLayoutInput) {
  const key = JSON.stringify([
    input.nodes.map((n) => [n.id, n.boundary ?? null]),
    input.edges.map((e) => [e.id, e.source, e.target]),
    input.settings,
    input.sizes ?? null,
  ]);
  const hit = cache.get(key);
  if (hit) return hit;
  const result = await layoutAll(input);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

/**
 * Generator for nodes without a manual position (LAYOUT-17, LAYOUT-24).
 * Lays out the whole diagram and keeps the positions of the pending nodes.
 * Nodes inside a boundary move with it (when the boundary was placed manually
 * or nudged); other nodes that would overlap an unrelated box are moved to the
 * nearest free slot. Manual positions are never changed.
 */
export function elkPositionGenerator(all: {
  nodes: readonly ResolvedNode[];
}): AsyncPositionGenerator {
  return async (input: GeneratorInput) => {
    const full = await layoutAllCached({
      nodes: all.nodes,
      edges: input.edges,
      settings: input.settings,
    });
    const byId = new Map(all.nodes.map((n) => [n.id, n]));
    const chains = new Map(all.nodes.map((n) => [n.id, boundaryChain(byId, n.id)]));
    const related = (a: string, b: string) =>
      chains.get(a)!.includes(b) || chains.get(b)!.includes(a);

    const taken: Array<[string, Box]> = input.occupied.map((box, i) => [
      input.occupiedIds?.[i] ?? `__occupied_${i}`,
      box,
    ]);
    const shift = new Map<string, { dx: number; dy: number; pending: boolean }>();
    for (const [id, box] of taken) {
      const g = full[id];
      if (g) shift.set(id, { dx: box.x - g.x, dy: box.y - g.y, pending: false });
    }

    // Boundaries before their contents, otherwise diagram order.
    const pending = [...input.nodes].sort(
      (a, b) => chains.get(a.id)!.length - chains.get(b.id)!.length,
    );
    const out: Record<string, GeneratedPosition> = {};
    for (const node of pending) {
      const g = full[node.id]!;
      const anchor = chains.get(node.id)!.find((b) => shift.has(b));
      const d = anchor !== undefined ? shift.get(anchor)! : { dx: 0, dy: 0, pending: false };
      const box = { ...g, x: g.x + d.dx, y: g.y + d.dy };
      let placed: Box = box;
      if (!(anchor !== undefined && d.pending)) {
        const others = taken.filter(([id]) => (byId.has(id) ? !related(node.id, id) : true));
        placed = nearestFreeSlot(
          box,
          others.map(([, b]) => b),
          input.settings.gridSize,
        );
      }
      out[node.id] = { ...g, x: placed.x, y: placed.y };
      shift.set(node.id, { dx: placed.x - g.x, dy: placed.y - g.y, pending: true });
      taken.push([node.id, placed]);
    }
    return out;
  };
}
