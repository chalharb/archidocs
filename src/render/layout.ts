import ElkBundled from "elkjs/lib/elk.bundled.js";
import type { ELK, ElkExtendedEdge, ElkNode, LayoutOptions } from "elkjs/lib/elk-api.js";
import type { ResolvedView, ViewNode } from "../core/views/index.ts";
import { textWidth } from "./text.ts";

/** Which way a View's edges flow: top to bottom, bottom to top, left to right or right to left. */
export type Direction = "TB" | "BT" | "LR" | "RL";
export const directions: readonly Direction[] = ["TB", "BT", "LR", "RL"];

/** One node's box, in absolute coordinates; a container's box holds its children's. */
export interface LaidOutNode {
  id: string;
  parent: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One View edge as a right-angled polyline from its `from` node's border to its `to` node's. */
export interface LaidOutEdge {
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

/** A View's Layout: nodes in the View's order, edges in the View's order, and the drawing's size. */
export interface Layout {
  direction: Direction;
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

export interface LayoutOptionsInput {
  /** Defaults to `LR`. */
  direction?: Direction;
  /** The ELK instance to run, such as one backed by a web worker in the browser; defaults to the bundled, in-thread one. */
  elk?: ELK;
}

/** The least size of a node per kind; `nodeSize` widens it for a long name. Containers are sized by their contents. */
export const NODE_SIZES: Record<ViewNode["kind"], { width: number; height: number }> = {
  // The Variant D prototype's sizes (ticket 14), 40px wider and up to 22px taller, so names fit and boxes breathe.
  person: { width: 200, height: 76 },
  system: { width: 230, height: 80 },
  service: { width: 220, height: 72 },
  component: { width: 210, height: 68 },
  target: { width: 240, height: 84 },
  deployment: { width: 220, height: 68 },
};

/** No box grows wider than this for its name; a longer name takes a second line instead. */
export const NODE_MAX_WIDTH = 360;
/** The extra height a box gets for a second line of name. */
export const NAME_LINE = 18;
/** What a box's head row holds beside the name: Team edge, padding, kind glyph and the Team code tile. */
const HEAD_CHROME = 116;
/** The expand toggle of a collapsed System or Service, and the way-in tile in an open box's head row. */
const TOGGLE_CHROME = 30;
const WAY_IN_CHROME = 30;

/** The room a box of this kind and state needs beside its name. */
function headChrome(n: ViewNode): number {
  const opens = n.kind === "system" || (n.kind === "service" && n.collapsed);
  return HEAD_CHROME + (n.collapsed && opens ? TOGGLE_CHROME : 0) + (n.kind === "person" ? 12 : 0);
}

/** The width a box of `width` leaves for its name. */
export function nameRoom(n: ViewNode, width: number): number {
  return width - headChrome(n);
}

/**
 * A box's size: its kind's size, widened in 10px steps until its name fits on one line, up to NODE_MAX_WIDTH;
 * a name longer than that takes two lines and the box grows by one. Measured with the embedded font's advances,
 * so the same View lays out the same everywhere.
 */
export function nodeSize(n: ViewNode): { width: number; height: number } {
  const base = NODE_SIZES[n.kind];
  const wanted = Math.ceil((textWidth(n.name, 13, 700) + headChrome(n)) / 10) * 10;
  const width = Math.min(NODE_MAX_WIDTH, Math.max(base.width, wanted));
  return { width, height: base.height + (wanted > NODE_MAX_WIDTH ? NAME_LINE : 0) };
}

/** What an open box's head row holds beside its name: Team edge, padding, glyph, its kind in words and the Team code tile. */
const CONTAINER_CHROME = 210;

/** The least width of an open box, so its head row shows its whole name; capped like any box, past which the name is cut. */
export function containerMinWidth(n: ViewNode): number {
  const opens = n.kind === "system" || n.kind === "service";
  return Math.min(NODE_MAX_WIDTH + 80, Math.ceil(textWidth(n.name, 13, 700) + CONTAINER_CHROME + (opens ? TOGGLE_CHROME + WAY_IN_CHROME : 0)));
}

/** Room at the top of a container for its label. */
export const CONTAINER_HEADER = 40;
const CONTAINER_PADDING = `[top=${CONTAINER_HEADER + 12},left=24,bottom=24,right=24]`;

const ELK_DIRECTION: Record<Direction, string> = { TB: "DOWN", BT: "UP", LR: "RIGHT", RL: "LEFT" };
/** The border side edges leave a container by, then the side they enter one by. */
const PORT_SIDES: Record<Direction, [string, string]> = {
  TB: ["SOUTH", "NORTH"],
  BT: ["NORTH", "SOUTH"],
  LR: ["EAST", "WEST"],
  RL: ["WEST", "EAST"],
};

// elk.bundled.js is CommonJS whose module.exports is the ELK class; its typings describe an ES module instead.
const ElkConstructor = ElkBundled as unknown as new () => ELK;
let sharedElk: ELK | undefined;

/**
 * Lays out a resolved View with elkjs `layered` and orthogonal routing. Each
 * container is laid out on its own (`SEPARATE_CHILDREN`): every edge that
 * leaves a container is cut at a port on its border, one port per
 * (container, direction, destination branch), so editing inside one System
 * leaves every other System's inside where it was. Children and edges are
 * sorted by id, which, with fixed node sizes, makes the Layout deterministic.
 */
export async function layoutView(view: ResolvedView, options: LayoutOptionsInput = {}): Promise<Layout> {
  const direction = options.direction ?? "LR";
  const elk = options.elk ?? (sharedElk ??= new ElkConstructor());
  const graph = new ViewGraph(view);
  const { root, routes } = toElk(graph, direction);
  const result = await elk.layout(root);
  return fromElk(result, graph, routes, direction);
}

/** A View's nodes as a tree, with lookups the layout needs. */
class ViewGraph {
  readonly byId: Map<string, ViewNode>;
  readonly childrenOf = new Map<string | null, ViewNode[]>();
  readonly view: ResolvedView;

  constructor(view: ResolvedView) {
    this.view = view;
    this.byId = new Map(view.nodes.map((n) => [n.id, n]));
    for (const n of view.nodes) {
      const list = this.childrenOf.get(n.parent) ?? [];
      list.push(n);
      this.childrenOf.set(n.parent, list);
    }
  }

  isContainer(id: string): boolean {
    return (this.childrenOf.get(id)?.length ?? 0) > 0;
  }

  /** The node's ancestors from the top level down, then the node itself. */
  chain(id: string): string[] {
    const out = [id];
    for (let p = this.byId.get(id)?.parent ?? null; p !== null && !out.includes(p); p = this.byId.get(p)?.parent ?? null) out.unshift(p);
    return out;
  }
}

/** One piece of a cut edge, laid out inside `owner` (null for the top level). */
interface Piece {
  id: string;
  owner: string | null;
  source: string;
  target: string;
}

/** Builds the ELK graph, returning with it each View edge's pieces in order (keyed by edge index). */
function toElk(graph: ViewGraph, direction: Direction): { root: ElkNode; routes: Map<number, string[]> } {
  const common: LayoutOptions = {
    "elk.algorithm": "layered",
    "elk.direction": ELK_DIRECTION[direction],
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.spacing.nodeNode": "48",
    "elk.layered.spacing.nodeNodeBetweenLayers": "72",
    "elk.spacing.edgeNode": "20",
    "elk.spacing.edgeEdge": "12",
    "elk.layered.spacing.edgeNodeBetweenLayers": "24",
    "elk.layered.spacing.edgeEdgeBetweenLayers": "12",
  };
  const [outSide, inSide] = PORT_SIDES[direction];
  const ports = new Map<string, Map<string, string>>();
  const addPort = (container: string, id: string, side: string) => {
    const list = ports.get(container) ?? new Map<string, string>();
    list.set(id, side);
    ports.set(container, list);
    return id;
  };
  const pieces = new Map<string, Piece>();
  const routes = new Map<number, string[]>();
  for (const [index, edge] of graph.view.edges.entries()) {
    const from = graph.chain(edge.from);
    const to = graph.chain(edge.to);
    // An edge between a container and something inside it has no border to cut; it isn't drawn.
    if (from.includes(edge.to) || to.includes(edge.from)) continue;
    let i = 0;
    while (i < from.length - 1 && i < to.length - 1 && from[i] === to[i]) i++;
    const [fromBranch, toBranch] = [from[i]!, to[i]!];
    // e.from → out-ports of its containers up to the branch → in-ports down to e.to.
    type Stop = { node: string; ref: string; inPort: boolean };
    const stops: Stop[] = [{ node: edge.from, ref: edge.from, inPort: false }];
    for (let k = from.length - 2; k >= i; k--) stops.push({ node: from[k]!, ref: addPort(from[k]!, `${from[k]}#out>${toBranch}`, outSide), inPort: false });
    for (let k = i; k <= to.length - 2; k++) stops.push({ node: to[k]!, ref: addPort(to[k]!, `${to[k]}#in<${fromBranch}`, inSide), inPort: true });
    stops.push({ node: edge.to, ref: edge.to, inPort: false });
    const route: string[] = [];
    for (const [k, a] of stops.slice(0, -1).entries()) {
      const b = stops[k + 1]!;
      const id = `${a.ref}=>${b.ref}`;
      // A piece leaving an in-port runs inside that container; any other runs beside its start node.
      pieces.set(id, { id, owner: a.inPort ? a.node : (graph.byId.get(a.node)?.parent ?? null), source: a.ref, target: b.ref });
      route.push(id);
    }
    routes.set(index, route);
  }

  const elkNodes = new Map<string, ElkNode>();
  const build = (n: ViewNode): ElkNode => {
    const children = (graph.childrenOf.get(n.id) ?? []).toSorted(byId).map(build);
    const nodePorts = [...(ports.get(n.id) ?? [])].sort(([a], [b]) => cmp(a, b));
    const node: ElkNode = {
      id: n.id,
      ...(children.length > 0 ? { children } : nodeSize(n)),
      ...(nodePorts.length > 0 ? { ports: nodePorts.map(([id, side]) => ({ id, width: 0, height: 0, layoutOptions: { "elk.port.side": side } })) } : {}),
      layoutOptions: {
        ...(children.length > 0 ? { ...common, "elk.padding": CONTAINER_PADDING, "elk.nodeSize.constraints": "MINIMUM_SIZE", "elk.nodeSize.minimum": `(${containerMinWidth(n)},0)` } : {}),
        ...(nodePorts.length > 0 ? { "elk.portConstraints": "FIXED_SIDE" } : {}),
      },
      edges: [],
    };
    elkNodes.set(n.id, node);
    return node;
  };
  const root: ElkNode = {
    id: "root",
    layoutOptions: {
      ...common,
      "elk.hierarchyHandling": "SEPARATE_CHILDREN",
      "elk.json.edgeCoords": "ROOT",
      "elk.padding": "[top=0,left=0,bottom=0,right=0]",
    },
    children: (graph.childrenOf.get(null) ?? []).toSorted(byId).map(build),
    edges: [],
  };
  for (const piece of [...pieces.values()].sort(byId)) {
    const owner = piece.owner === null ? root : elkNodes.get(piece.owner)!;
    owner.edges!.push({ id: piece.id, sources: [piece.source], targets: [piece.target] } satisfies ElkExtendedEdge);
  }
  return { root, routes };
}

function fromElk(result: ElkNode, graph: ViewGraph, routes: Map<number, string[]>, direction: Direction): Layout {
  const boxes = new Map<string, LaidOutNode>();
  const sections = new Map<string, { x: number; y: number }[]>();
  const walk = (n: ElkNode, ox: number, oy: number) => {
    for (const e of n.edges ?? []) {
      const s = e.sections?.[0];
      if (s) sections.set(e.id, [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]);
    }
    for (const c of n.children ?? []) {
      const [x, y] = [ox + (c.x ?? 0), oy + (c.y ?? 0)];
      boxes.set(c.id, { id: c.id, parent: graph.byId.get(c.id)?.parent ?? null, x, y, width: c.width ?? 0, height: c.height ?? 0 });
      walk(c, x, y);
    }
  };
  walk(result, 0, 0);
  const edges: LaidOutEdge[] = [];
  for (const [index, edge] of graph.view.edges.entries()) {
    const route = routes.get(index);
    if (!route) continue;
    edges.push({ from: edge.from, to: edge.to, points: simplify(route.flatMap((id) => sections.get(id) ?? [])) });
  }
  return {
    direction,
    width: result.width ?? 0,
    height: result.height ?? 0,
    nodes: graph.view.nodes.map((n) => boxes.get(n.id)!),
    edges,
  };
}

/** Drops repeated points and the middle of three points on one line, where two pieces of an edge meet. */
function simplify(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (last && same(last.x, p.x) && same(last.y, p.y)) continue;
    const before = out.at(-2);
    if (before && last && ((same(before.x, last.x) && same(last.x, p.x)) || (same(before.y, last.y) && same(last.y, p.y)))) out.pop();
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byId = <T extends { id: string }>(a: T, b: T) => cmp(a.id, b.id);
