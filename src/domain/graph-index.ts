/**
 * Architecture graph index (P0-06): fast, deterministic lookups over the model.
 *
 * The index is plain data (records of sorted ID arrays), built in one pass and
 * rebuilt from scratch whenever the model changes. Identical models always give
 * identical indexes.
 */
import type { ArchitectureModel } from "./model";
import { compareCodePoints, sortRecord } from "./order";

export interface GraphIndex {
  /** Relationship IDs whose source is the entity. */
  outgoing: Record<string, string[]>;
  /** Relationship IDs whose target is the entity. */
  incoming: Record<string, string[]>;
  /** Parent entity ID of each entity that has a valid parent. */
  parent: Record<string, string>;
  /** Direct child entity IDs. */
  children: Record<string, string[]>;
  /** Diagram IDs that show the entity (DIAG-07 reverse references). */
  entityDiagrams: Record<string, string[]>;
  /** Diagram IDs that show the relationship. */
  relationshipDiagrams: Record<string, string[]>;
  /** Entity IDs of each entity type, including subtypes' entities only via their own type. */
  entitiesByType: Record<string, string[]>;
}

function push(map: Map<string, Set<string>>, key: string, value: string) {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(value);
}

function finish(map: Map<string, Set<string>>): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const [k, v] of map) record[k] = [...v].sort(compareCodePoints);
  return sortRecord(record);
}

export function buildGraphIndex(model: ArchitectureModel): GraphIndex {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  const entityDiagrams = new Map<string, Set<string>>();
  const relationshipDiagrams = new Map<string, Set<string>>();
  const entitiesByType = new Map<string, Set<string>>();
  const parent: Record<string, string> = {};

  for (const r of Object.values(model.relationships)) {
    if (model.entities[r.source]) push(outgoing, r.source, r.id);
    if (model.entities[r.target]) push(incoming, r.target, r.id);
  }
  for (const e of Object.values(model.entities)) {
    push(entitiesByType, e.type, e.id);
    if (e.parent !== undefined && e.parent !== e.id && model.entities[e.parent]) {
      parent[e.id] = e.parent;
      push(children, e.parent, e.id);
    }
  }
  for (const d of Object.values(model.diagrams)) {
    for (const n of d.nodes) if (model.entities[n.entity]) push(entityDiagrams, n.entity, d.id);
    for (const e of d.edges)
      if (model.relationships[e.relationship]) push(relationshipDiagrams, e.relationship, d.id);
  }

  return {
    outgoing: finish(outgoing),
    incoming: finish(incoming),
    parent: sortRecord(parent),
    children: finish(children),
    entityDiagrams: finish(entityDiagrams),
    relationshipDiagrams: finish(relationshipDiagrams),
    entitiesByType: finish(entitiesByType),
  };
}

const EMPTY: readonly string[] = Object.freeze([]);

export const lookup = {
  outgoing: (index: GraphIndex, id: string): readonly string[] => index.outgoing[id] ?? EMPTY,
  incoming: (index: GraphIndex, id: string): readonly string[] => index.incoming[id] ?? EMPTY,
  children: (index: GraphIndex, id: string): readonly string[] => index.children[id] ?? EMPTY,
  parent: (index: GraphIndex, id: string): string | undefined => index.parent[id],
  diagramsForEntity: (index: GraphIndex, id: string): readonly string[] =>
    index.entityDiagrams[id] ?? EMPTY,
  diagramsForRelationship: (index: GraphIndex, id: string): readonly string[] =>
    index.relationshipDiagrams[id] ?? EMPTY,
  /** Ancestors from nearest to root; safe on cyclic data. */
  ancestors(index: GraphIndex, id: string): string[] {
    const out: string[] = [];
    const seen = new Set([id]);
    let current = index.parent[id];
    while (current !== undefined && !seen.has(current)) {
      out.push(current);
      seen.add(current);
      current = index.parent[current];
    }
    return out;
  },
  /** All descendants in breadth-first, sorted-per-level order; safe on cyclic data. */
  descendants(index: GraphIndex, id: string): string[] {
    const out: string[] = [];
    const seen = new Set([id]);
    const queue = [id];
    while (queue.length > 0) {
      for (const child of index.children[queue.shift()!] ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        out.push(child);
        queue.push(child);
      }
    }
    return out;
  },
};
