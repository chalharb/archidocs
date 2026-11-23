import type { Bundle, BundleElement, BundleRelationship } from "../schema/bundle.ts";
import { cmp, Graph, levelOf, lifter, within } from "./query.ts";

export type Direction = "upstream" | "downstream" | "both";

/** An Element reached by the impact, with the Relationships that carry it there from the ring before. */
export interface ImpactedElement {
  id: string;
  kind: BundleElement["kind"];
  name: string;
  owner: string;
  relationships: BundleRelationship[];
}

/** The Elements at one distance from the Element given. */
export interface ImpactRing {
  distance: number;
  elements: ImpactedElement[];
}

export interface ImpactResult {
  id: string;
  direction: Direction;
  maxDepth: number | null;
  /** Everything that depends on the Element, nearest first; set unless `direction` is `downstream`. */
  upstream?: ImpactRing[];
  /** Everything the Element depends on, nearest first; set unless `direction` is `upstream`. */
  downstream?: ImpactRing[];
}

/**
 * The transitive set of Elements an outage of `id` reaches, grouped by
 * distance. Relationships declared beneath `id` count as its own; every other
 * end is lifted to `id`'s level. A Relationship through a `via` broker makes
 * both its consumer and its provider depend on the broker. Depth is
 * unlimited unless `maxDepth` is given.
 */
export function getImpact(bundle: Bundle, id: string, direction: Direction, options: { maxDepth?: number } = {}): ImpactResult {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const element = byId.get(id);
  if (!element) throw new Error(`Unknown Element "${id}"`);

  const inside = within(bundle);
  const lift = lifter(bundle, levelOf(element));
  const place = (x: string) => (inside(x, id) ? id : lift(x));

  const dependsOn = new Graph();
  for (const r of bundle.relationships) {
    dependsOn.add(place(r.from), place(r.to), r);
    if (r.via) {
      dependsOn.add(place(r.from), place(r.via), r);
      dependsOn.add(place(r.to), place(r.via), r);
    }
  }

  const maxDepth = options.maxDepth ?? Infinity;
  const spread = (graph: Graph): ImpactRing[] => {
    const seen = new Set([id]);
    const rings: ImpactRing[] = [];
    let frontier = [id];
    for (let distance = 1; distance <= maxDepth && frontier.length; distance++) {
      const reached = new Map<string, BundleRelationship[]>();
      for (const node of frontier) {
        for (const [next, rels] of graph.next(node)) {
          if (seen.has(next)) continue;
          reached.set(next, [...(reached.get(next) ?? []), ...rels.filter((r) => !reached.get(next)?.includes(r))]);
        }
      }
      if (!reached.size) break;
      const elements = [...reached]
        .sort(([a], [b]) => cmp(a, b))
        .map(([x, rels]) => {
          const e = byId.get(x);
          const order = (r: BundleRelationship) => bundle.relationships.indexOf(r);
          return { id: x, kind: e?.kind ?? "service", name: e?.name ?? x, owner: e?.owner ?? "", relationships: rels.sort((p, q) => order(p) - order(q)) };
        });
      for (const e of elements) seen.add(e.id);
      rings.push({ distance, elements });
      frontier = elements.map((e) => e.id);
    }
    return rings;
  };

  return {
    id,
    direction,
    maxDepth: options.maxDepth ?? null,
    ...(direction !== "downstream" ? { upstream: spread(dependsOn.reversed()) } : {}),
    ...(direction !== "upstream" ? { downstream: spread(dependsOn) } : {}),
  };
}
