import type { Bundle, BundleRelationship } from "../schema/bundle.ts";
import { cmp, finer, Graph, levelOf, lifter, within } from "./query.ts";

/** One step along a path, with the Relationships that carry it. */
export interface Hop {
  from: string;
  to: string;
  relationships: BundleRelationship[];
}

/** A path between the two Elements, in the direction its Relationships point. */
export interface Path {
  hops: Hop[];
}

/**
 * The Relationships straight between the two Elements in one direction:
 * declared on exactly those two (`derived: false`), or declared beneath
 * either and lifted to them (`derived: true`).
 */
export interface DirectEdge {
  from: string;
  to: string;
  derived: boolean;
  relationships: BundleRelationship[];
}

export interface PathsResult {
  from: string;
  to: string;
  maxHops: number;
  direct: DirectEdge[];
  /** The shortest paths each way, shortest first. */
  paths: Path[];
}

/**
 * How two Elements are connected, compared at their own levels. Each
 * Relationship's end inside either Element is lifted to that Element; every
 * other end is lifted to the finer of the two Elements' levels. A Relationship
 * through a `via` broker runs consumer → broker → provider, so the broker is
 * a hop. Paths follow Relationships from consumer to provider, and are
 * searched both ways: `from` to `to`, then `to` to `from`.
 */
export function findPaths(bundle: Bundle, from: string, to: string, options: { maxHops?: number } = {}): PathsResult {
  const maxHops = options.maxHops ?? 4;
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const a = byId.get(from);
  const b = byId.get(to);
  if (!a || !b) throw new Error(`Unknown Element "${!a ? from : to}"`);

  const inside = within(bundle);
  const graph = connections(bundle, from, to);

  const direct: DirectEdge[] = [];
  for (const [x, y] of [[from, to], [to, from]] as const) {
    const rels = bundle.relationships.filter((r) => inside(r.from, x) && inside(r.to, y) && !(inside(r.from, y) && inside(r.to, x)));
    const declared = rels.filter((r) => r.from === x && r.to === y);
    const derived = rels.filter((r) => !declared.includes(r));
    if (declared.length) direct.push({ from: x, to: y, derived: false, relationships: declared });
    if (derived.length) direct.push({ from: x, to: y, derived: true, relationships: derived });
  }

  const paths = [...shortestPaths(graph, from, to, maxHops), ...shortestPaths(graph, to, from, maxHops)].sort(
    (p, q) => p.hops.length - q.hops.length || cmp(ids(p), ids(q)),
  );
  return { from, to, maxHops, direct, paths };
}

/**
 * The paths a path selector or Lens takes between two Elements, both ways:
 * `shortest` gives the shortest paths each way, however long; n gives every
 * path without a repeated node of at most n hops. Unknown ids give none.
 */
export function pathsBetween(bundle: Bundle, from: string, to: string, paths: "shortest" | number): Path[] {
  const known = new Set(bundle.elements.map((e) => e.id));
  if (!known.has(from) || !known.has(to) || from === to) return [];
  const graph = connections(bundle, from, to);
  const found =
    paths === "shortest"
      ? [...shortestPaths(graph, from, to, known.size), ...shortestPaths(graph, to, from, known.size)]
      : [...allPaths(graph, from, to, paths), ...allPaths(graph, to, from, paths)];
  return found.sort((p, q) => p.hops.length - q.hops.length || cmp(ids(p), ids(q)));
}

/**
 * The graph `findPaths` searches between two Elements: each Relationship's
 * end inside either Element is lifted to it, every other end to the finer of
 * their two levels, and a `via` broker is a hop of its own.
 */
function connections(bundle: Bundle, from: string, to: string): Graph {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const inside = within(bundle);
  const lift = lifter(bundle, finer(levelOf(byId.get(from)!), levelOf(byId.get(to)!)));
  // The more specific of the two wins when one is inside the other.
  const [inner, outer] = inside(to, from) ? [to, from] : [from, to];
  const place = (id: string) => (inside(id, inner) ? inner : inside(id, outer) ? outer : lift(id));

  const graph = new Graph();
  for (const r of bundle.relationships) {
    if (r.via) {
      graph.add(place(r.from), place(r.via), r);
      graph.add(place(r.via), place(r.to), r);
    } else graph.add(place(r.from), place(r.to), r);
  }
  return graph;
}

/** Every path from `source` to `target` of at most `maxHops` hops that repeats no node. */
function allPaths(graph: Graph, source: string, target: string, maxHops: number): Path[] {
  const found: Path[] = [];
  const walk = (nodes: string[]) => {
    const at = nodes.at(-1)!;
    if (at === target) {
      found.push({ hops: nodes.slice(1).map((n, i) => ({ from: nodes[i]!, to: n, relationships: graph.out.get(nodes[i]!)!.get(n)! })) });
      return;
    }
    if (nodes.length > maxHops) return;
    for (const [next] of graph.next(at)) if (!nodes.includes(next)) walk([...nodes, next]);
  };
  walk([source]);
  return found;
}

const ids = (p: Path) => [p.hops[0]?.from, ...p.hops.map((h) => h.to)].join("\0");

/** Every shortest path from `source` to `target` of at most `maxHops` hops. */
function shortestPaths(graph: Graph, source: string, target: string, maxHops: number): Path[] {
  const dist = new Map([[source, 0]]);
  const preds = new Map<string, string[]>();
  let frontier = [source];
  for (let d = 1; d <= maxHops && frontier.length && !dist.has(target); d++) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const [n] of graph.next(node)) {
        if (dist.has(n) && dist.get(n) !== d) continue;
        if (!dist.has(n)) {
          dist.set(n, d);
          next.push(n);
        }
        preds.set(n, [...(preds.get(n) ?? []), node]);
      }
    }
    frontier = next;
  }
  if (!dist.has(target) || source === target) return [];

  const walk = (node: string): string[][] => (node === source ? [[source]] : (preds.get(node) ?? []).flatMap((p) => walk(p).map((w) => [...w, node])));
  return walk(target).map((nodes) => ({
    hops: nodes.slice(1).map((n, i) => ({ from: nodes[i]!, to: n, relationships: graph.out.get(nodes[i]!)!.get(n)! })),
  }));
}
