/**
 * Hierarchy helpers shared by validation, indexing and resolution:
 * cycle detection (SCHEMA-05, MODEL-10) and type inheritance (SCHEMA-06).
 */
import { compareCodePoints } from "./order";

/**
 * Find every cycle in a functional graph (each node has at most one successor).
 * Each cycle is returned once, rotated to start at its smallest ID, and cycles
 * are sorted, so the result is deterministic.
 */
export function findCycles(
  ids: Iterable<string>,
  next: (id: string) => string | undefined,
): string[][] {
  const state = new Map<string, 1 | 2>(); // 1 = on current path, 2 = finished
  const cycles: string[][] = [];
  for (const start of [...ids].sort(compareCodePoints)) {
    if (state.has(start)) continue;
    const path: string[] = [];
    let current: string | undefined = start;
    while (current !== undefined && !state.has(current)) {
      state.set(current, 1);
      path.push(current);
      current = next(current);
    }
    if (current !== undefined && state.get(current) === 1) {
      const cycle = path.slice(path.indexOf(current));
      const min = cycle.reduce((a, b) => (compareCodePoints(a, b) <= 0 ? a : b));
      const at = cycle.indexOf(min);
      cycles.push([...cycle.slice(at), ...cycle.slice(0, at)]);
    }
    for (const id of path) state.set(id, 2);
  }
  return cycles.sort((a, b) => compareCodePoints(a[0]!, b[0]!));
}

interface Extensible {
  extends?: string;
}

/**
 * The inheritance chain of `id`, starting with `id` itself. Stops at missing
 * parents and never loops on cycles.
 */
export function ancestry(types: Record<string, Extensible>, id: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = types[current]?.extends;
  }
  return chain;
}

/** True when `type` is `ancestor` or inherits from it (SCHEMA-06). */
export function isSubtypeOf(
  types: Record<string, Extensible>,
  type: string,
  ancestor: string,
): boolean {
  return ancestry(types, type).includes(ancestor);
}

interface Constrained extends Extensible {
  sources?: string[];
  targets?: string[];
}

/** Effective endpoint constraints of a relationship type, inherited from the nearest ancestor that sets them. */
export function effectiveConstraints(
  relationshipTypes: Record<string, Constrained>,
  id: string,
): { sources?: string[]; targets?: string[] } {
  let sources: string[] | undefined;
  let targets: string[] | undefined;
  for (const t of ancestry(relationshipTypes, id)) {
    const def = relationshipTypes[t];
    if (!def) break;
    sources ??= def.sources;
    targets ??= def.targets;
  }
  return { ...(sources ? { sources } : {}), ...(targets ? { targets } : {}) };
}
