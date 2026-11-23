import type { Bundle, BundleElement, BundleRelationship } from "../schema/bundle.ts";

/** The levels edges can be derived at, from System (C1) down to Component (C3). */
export type Level = "system" | "service" | "component";

/** An edge between two Elements at one level, with the declared Relationships beneath it. */
export interface DerivedEdge {
  from: string;
  to: string;
  relationships: BundleRelationship[];
}

const depth: Record<BundleElement["kind"] | Level, number> = { person: 1, system: 1, service: 2, component: 3 };

/** The level an Element sits at: a Person sits at System level. */
export const levelOf = (e: BundleElement): Level => (e.kind === "person" ? "system" : e.kind);

/** The finer of two levels. */
export const finer = (a: Level, b: Level): Level => (depth[a] >= depth[b] ? a : b);

/**
 * Lifts an Element id to its ancestor at `level`; an Element with no such
 * ancestor, such as a Person or a Service outside any System, stays itself.
 */
export function lifter(bundle: Bundle, level: Level): (id: string) => string {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  return (id) => {
    let e = byId.get(id);
    while (e && depth[e.kind] > depth[level] && e.parent !== null && byId.has(e.parent)) e = byId.get(e.parent);
    return e?.id ?? id;
  };
}

/** Whether `id` is `root` or one of its descendants. */
export function within(bundle: Bundle): (id: string, root: string) => boolean {
  const parentOf = new Map(bundle.elements.map((e) => [e.id, e.parent]));
  return (id, root) => {
    for (let at: string | null | undefined = id; at; at = parentOf.get(at)) if (at === root) return true;
    return false;
  };
}

/**
 * Derives the edges between Elements at `level`: each Relationship's ends are
 * lifted to their ancestor at that level, and the Relationships landing on
 * one pair form one edge. An edge that collapses onto a single node is
 * dropped. Edges are sorted by `from`, then `to`.
 */
export function deriveEdges(bundle: Bundle, level: Level): DerivedEdge[] {
  const lift = lifter(bundle, level);
  const edges = new Map<string, DerivedEdge>();
  for (const r of bundle.relationships) {
    const from = lift(r.from);
    const to = lift(r.to);
    if (from === to) continue;
    const key = `${from}\0${to}`;
    const edge = edges.get(key) ?? { from, to, relationships: [] };
    edge.relationships.push(r);
    edges.set(key, edge);
  }
  return [...edges.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));
}

/** A directed graph whose edges carry the Relationships beneath them. */
export class Graph {
  readonly out = new Map<string, Map<string, BundleRelationship[]>>();

  add(from: string, to: string, r: BundleRelationship): void {
    if (from === to) return;
    const next = this.out.get(from) ?? new Map<string, BundleRelationship[]>();
    const rels = next.get(to) ?? [];
    if (!rels.includes(r)) rels.push(r);
    next.set(to, rels);
    this.out.set(from, next);
  }

  /** The graph with every edge turned round. */
  reversed(): Graph {
    const g = new Graph();
    for (const [from, next] of this.out) for (const [to, rels] of next) for (const r of rels) g.add(to, from, r);
    return g;
  }

  /** Neighbours of a node, sorted by id. */
  next(id: string): [string, BundleRelationship[]][] {
    return [...(this.out.get(id) ?? new Map<string, BundleRelationship[]>())].sort(([a], [b]) => cmp(a, b));
  }
}

export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
