import type { Bundle, BundleElement, BundleRelationship } from "../schema/bundle.ts";

/** The levels edges can be derived at, from System (C1) down to Component (C3). */
export type Level = "system" | "service" | "component";

/** An edge between two Elements at one level, with the declared Relationships beneath it. */
export interface DerivedEdge {
  from: string;
  to: string;
  relationships: BundleRelationship[];
}

const depth: Record<BundleElement["kind"], number> = { person: 1, system: 1, service: 2, component: 3 };

/**
 * Derives the edges between Elements at `level`: each Relationship's ends are
 * lifted to their ancestor at that level (an Element with no such ancestor,
 * such as a Person or a Service outside any System, stays itself), and the
 * Relationships landing on one pair form one edge. An edge that collapses
 * onto a single node is dropped. Edges are sorted by `from`, then `to`.
 */
export function deriveEdges(bundle: Bundle, level: Level): DerivedEdge[] {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const lift = (id: string) => {
    let e = byId.get(id);
    while (e && depth[e.kind] > depth[level] && e.parent !== null && byId.has(e.parent)) e = byId.get(e.parent);
    return e?.id ?? id;
  };

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

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
