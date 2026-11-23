import type { Bundle, BundleDeployment, BundleRelationship } from "../schema/bundle.ts";

/** The kinds of Model item a Change can be about, in the order Changes are listed. */
export const changeKinds = ["team", "environment", "project", "element", "relationship", "target", "deployment", "view", "adr"] as const;
export type ChangeKind = (typeof changeKinds)[number];
export type ChangeType = "added" | "removed" | "changed";

/** One Model item as diffed: the Bundle item without its `source`. */
export type ChangeItem = Record<string, unknown>;

/**
 * One item of the Model added, removed or changed between two Bundles.
 * `before` and `after` are the whole item at each side (null where it is
 * missing); `fields` names the fields that differ, in the item's key order,
 * and is empty for an added or removed item.
 */
export interface Change {
  type: ChangeType;
  kind: ChangeKind;
  /** The item's id; a Relationship without one is `from -> to`, a Deployment `service in environment on target`. */
  id: string;
  fields: string[];
  before: ChangeItem | null;
  after: ChangeItem | null;
}

/** Counts of Changes by type. */
export interface ChangeCounts {
  added: number;
  removed: number;
  changed: number;
}

/**
 * The Changes from one Bundle to another: a flat list ordered by kind, then
 * id. Items match by (qualified) id, Deployments by their triple, and
 * Relationships by id, else by a pair with one Relationship at each side,
 * else by (pair, technology, interaction); anything unmatched is removed
 * plus added. `source`, key order, `commit` and `builtAt` are ignored, and
 * derived edges are never compared. Owners in a Bundle are already effective.
 */
export function diff(before: Bundle, after: Bundle): Change[] {
  const changes: Change[] = [];
  const byId = <T extends { id: string }>(kind: ChangeKind, a: T[], b: T[]) => compareMatched(kind, matchBy(a, b, (x) => x.id), (x) => x.id, changes);
  byId("team", before.teams, after.teams);
  byId("environment", before.environments, after.environments);
  byId("project", before.projects, after.projects);
  byId("element", before.elements, after.elements);
  compareMatched("relationship", matchRelationships(before.relationships, after.relationships), relationshipId, changes);
  byId("target", before.targets, after.targets);
  compareMatched("deployment", matchBy(before.deployments, after.deployments, deploymentId), deploymentId, changes);
  byId("view", before.views, after.views);
  byId("adr", before.adrs, after.adrs);

  const typeOrder: Record<ChangeType, number> = { changed: 0, removed: 1, added: 2 };
  return changes.sort((a, b) => changeKinds.indexOf(a.kind) - changeKinds.indexOf(b.kind) || cmp(a.id, b.id) || typeOrder[a.type] - typeOrder[b.type]);
}

export function countChanges(changes: Change[]): ChangeCounts {
  const counts: ChangeCounts = { added: 0, removed: 0, changed: 0 };
  for (const c of changes) counts[c.type]++;
  return counts;
}

/**
 * The ids a list of Changes touches: each item's own id, plus the Elements
 * and Deployment Targets a Relationship, Deployment or ADR names at either
 * side. Sorted and unique; this is what a Revision index entry records.
 */
export function changedIds(changes: Change[]): string[] {
  const ids = new Set<string>();
  for (const c of changes) {
    if (c.kind !== "relationship" && c.kind !== "deployment") ids.add(c.id);
    for (const item of [c.before, c.after]) {
      if (!item) continue;
      if (c.kind === "relationship") for (const key of ["from", "to"]) ids.add(item[key] as string);
      if (c.kind === "deployment") for (const key of ["service", "target"]) ids.add(item[key] as string);
      if (c.kind === "adr") for (const id of item.elements as string[]) ids.add(id);
    }
  }
  return [...ids].sort(cmp);
}

const relationshipId = (r: BundleRelationship) => r.id ?? `${r.from} -> ${r.to}`;
const deploymentId = (d: BundleDeployment) => `${d.service} in ${d.environment} on ${d.target}`;

interface Matched<T> {
  pairs: [T, T][];
  removed: T[];
  added: T[];
}

/** Pairs items whose key is unique at both sides; the rest are left over. */
function matchBy<T>(before: T[], after: T[], key: (x: T) => string): Matched<T> {
  const groups = (xs: T[]) => {
    const map = new Map<string, T[]>();
    for (const x of xs) map.set(key(x), [...(map.get(key(x)) ?? []), x]);
    return map;
  };
  const a = groups(before);
  const b = groups(after);
  const paired = new Set<T>();
  const pairs: [T, T][] = [];
  for (const [k, xs] of a) {
    const ys = b.get(k);
    if (xs.length === 1 && ys?.length === 1) {
      pairs.push([xs[0]!, ys[0]!]);
      paired.add(xs[0]!).add(ys[0]!);
    }
  }
  return { pairs, removed: before.filter((x) => !paired.has(x)), added: after.filter((x) => !paired.has(x)) };
}

/**
 * Relationships: by id where both sides have one, then by a pair with
 * exactly one Relationship at each side, then by a (pair, technology,
 * interaction) that is unique at each side. Uniqueness is counted over all
 * Relationships not matched by id. Relationships identical at both sides are
 * set aside first, so an unchanged one never shows as removed plus added.
 */
function matchRelationships(before: BundleRelationship[], after: BundleRelationship[]): Matched<BundleRelationship> {
  const withId = (xs: BundleRelationship[]) => xs.filter((r) => r.id !== null);
  const byId = matchBy(withId(before), withId(after), (r) => r.id!);
  const idMatched = new Set(byId.pairs.flat());
  const restBefore = before.filter((r) => !idMatched.has(r));
  const restAfter = after.filter((r) => !idMatched.has(r));

  const pairs: [BundleRelationship, BundleRelationship][] = [...byId.pairs];
  const matched = new Set<BundleRelationship>(idMatched);
  const pairUp = (key: (r: BundleRelationship) => string, unique: boolean) => {
    const count = (xs: BundleRelationship[]) => xs.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<string, number>());
    const [inBefore, inAfter] = [count(restBefore), count(restAfter)];
    const waiting = new Map<string, BundleRelationship[]>();
    for (const r of restAfter) if (!matched.has(r)) waiting.set(key(r), [...(waiting.get(key(r)) ?? []), r]);
    for (const r of restBefore) {
      if (matched.has(r) || (unique && (inBefore.get(key(r)) !== 1 || inAfter.get(key(r)) !== 1))) continue;
      const other = waiting.get(key(r))?.shift();
      if (!other) continue;
      pairs.push([r, other]);
      matched.add(r).add(other);
    }
  };
  pairUp((r) => canonical(item(r)), false);
  pairUp((r) => JSON.stringify([r.from, r.to]), true);
  pairUp((r) => JSON.stringify([r.from, r.to, r.technology, r.interaction]), true);
  return { pairs, removed: before.filter((r) => !matched.has(r)), added: after.filter((r) => !matched.has(r)) };
}

function compareMatched<T extends object>(kind: ChangeKind, matched: Matched<T>, id: (x: T) => string, changes: Change[]) {
  for (const [a, b] of matched.pairs) {
    const before = item(a);
    const after = item(b);
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => canonical(before[f]) !== canonical(after[f]));
    if (fields.length > 0) changes.push({ type: "changed", kind, id: id(b), fields, before, after });
  }
  for (const x of matched.removed) changes.push({ type: "removed", kind, id: id(x), fields: [], before: item(x), after: null });
  for (const x of matched.added) changes.push({ type: "added", kind, id: id(x), fields: [], before: null, after: item(x) });
}

function item(x: object): ChangeItem {
  return Object.fromEntries(Object.entries(x).filter(([key]) => key !== "source"));
}

/** JSON with object keys sorted, so key order never counts as a change. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => cmp(a, b))) : v,
  );
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
