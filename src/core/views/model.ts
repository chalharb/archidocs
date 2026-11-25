import type { Bundle, BundleElement, BundleRelationship } from "../../schema/bundle.ts";
import { cmp } from "../query.ts";
import type { ResolvedView, ViewEdge } from "./types.ts";

/** Lookups over a Bundle's Elements. */
export class ModelIndex {
  readonly elements: BundleElement[];
  readonly relationships: BundleRelationship[];
  readonly byId: Map<string, BundleElement>;
  private readonly childrenOf = new Map<string, BundleElement[]>();

  constructor(bundle: Bundle) {
    this.elements = bundle.elements;
    this.relationships = bundle.relationships;
    this.byId = new Map(bundle.elements.map((e) => [e.id, e]));
    for (const e of bundle.elements) {
      if (e.parent === null) continue;
      const list = this.childrenOf.get(e.parent) ?? [];
      list.push(e);
      this.childrenOf.set(e.parent, list);
    }
  }

  children(id: string): BundleElement[] {
    return this.childrenOf.get(id) ?? [];
  }

  /** The Element itself, then its parent, and so on up to the top level. Unknown ids yield only themselves. */
  ancestry(id: string): string[] {
    const out = [id];
    const seen = new Set(out);
    for (let p = this.byId.get(id)?.parent; p != null && !seen.has(p) && this.byId.has(p); p = this.byId.get(p)?.parent) {
      out.push(p);
      seen.add(p);
    }
    return out;
  }
}

/**
 * Builds a View from the set of Elements it shows: each Relationship's ends
 * are lifted to their nearest shown ancestor-or-self, and the Relationships
 * landing on one pair form one edge. An edge is kept when `keep` accepts the
 * declared Relationship and its ends are two different nodes. It draws
 * left to right.
 */
export function build(
  model: ModelIndex,
  head: Pick<ResolvedView, "id" | "kind" | "title">,
  shown: Set<string>,
  keep: (r: BundleRelationship) => boolean,
): ResolvedView {
  const lift = (id: string) => model.ancestry(id).find((a) => shown.has(a));
  const edges = new Map<string, ViewEdge>();
  for (const r of model.relationships) {
    if (!keep(r)) continue;
    const from = lift(r.from);
    const to = lift(r.to);
    if (from === undefined || to === undefined || from === to) continue;
    const key = `${from}\0${to}`;
    const edge = edges.get(key) ?? { from, to, relationships: [] };
    edge.relationships.push(r);
    edges.set(key, edge);
  }
  const nodes = [...shown]
    .map((id) => model.byId.get(id))
    .filter((e) => e !== undefined)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      parent: model.ancestry(e.id).slice(1).find((a) => shown.has(a)) ?? null,
      collapsed: model.children(e.id).some((c) => !shown.has(c.id)),
      external: "external" in e && e.external,
    }))
    .sort((a, b) => cmp(a.id, b.id));
  return { ...head, direction: "LR", nodes, edges: [...edges.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to)) };
}
