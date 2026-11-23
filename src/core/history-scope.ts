import type { Bundle } from "../schema/bundle.ts";
import { changedIds, type Change, type ChangeKind } from "./diff.ts";

/** What a history question is narrowed to: an Element (with its descendants), a Team or a Project. */
export interface HistoryScope {
  kind: "element" | "team" | "project";
  id: string;
}

export type ScopeResolution = { ok: true; scope: HistoryScope } | { ok: false; reason: "not_found" | "ambiguous"; candidates: HistoryScope[]; known: string[] };

/**
 * Works out what `id` names in any of `bundles`: an Element (by qualified
 * id), a Team or a Project. `kind` picks one when a Team and a Project share
 * an id. `elementIds` adds Element ids known from elsewhere, such as the
 * Revision index, for Elements that exist in none of the Bundles.
 */
export function resolveScope(id: string, bundles: Bundle[], kind?: HistoryScope["kind"], elementIds: string[] = []): ScopeResolution {
  const ids = {
    element: new Set([...bundles.flatMap((b) => b.elements.map((e) => e.id)), ...elementIds.filter((i) => i.includes(":"))]),
    team: new Set(bundles.flatMap((b) => b.teams.map((t) => t.id))),
    project: new Set(bundles.flatMap((b) => b.projects.map((p) => p.id))),
  };
  const candidates = (Object.keys(ids) as HistoryScope["kind"][]).filter((k) => (kind === undefined || k === kind) && ids[k].has(id)).map((k) => ({ kind: k, id }));
  if (candidates.length === 1) return { ok: true, scope: candidates[0]! };
  const known = [...new Set(Object.values(ids).flatMap((s) => [...s]))];
  return { ok: false, reason: candidates.length ? "ambiguous" : "not_found", candidates, known };
}

/**
 * A test of the ids a Change or a Revision touched (see `changedIds`)
 * against a scope, as it stands in `bundles`: an Element and its
 * descendants; a Team and everything it owns; a Project and every id in it.
 */
export function scopeMatcher(scope: HistoryScope, bundles: Bundle[]): (ids: string[]) => boolean {
  if (scope.kind === "project") {
    const prefix = `${scope.id}:`;
    return (ids) => ids.some((i) => i === scope.id || i.startsWith(prefix));
  }
  const inScope = new Set([scope.id]);
  for (const b of bundles) {
    if (scope.kind === "team") {
      for (const item of [...b.elements, ...b.targets, ...b.projects]) if (item.owner === scope.id) inScope.add(item.id);
    } else {
      // Descendants: walk parents until nothing more joins.
      let grew = true;
      while (grew) {
        grew = false;
        for (const e of b.elements) {
          if (e.parent !== null && inScope.has(e.parent) && !inScope.has(e.id)) {
            inScope.add(e.id);
            grew = true;
          }
        }
      }
    }
  }
  return (ids) => ids.some((i) => inScope.has(i));
}

/**
 * The Changes between `before` and `after` within a scope and of some kinds.
 * A Team's scope takes what it owns at either side, so an item handed to or
 * from it is listed.
 */
export function filterChanges(changes: Change[], options: { before: Bundle; after: Bundle; scope?: HistoryScope; kinds?: ChangeKind[] }): Change[] {
  const { scope, kinds } = options;
  const matches = scope ? scopeMatcher(scope, [options.before, options.after]) : undefined;
  const ownedBy = (c: Change) => scope?.kind === "team" && [c.before, c.after].some((item) => item?.owner === scope.id);
  return changes.filter((c) => (!kinds || kinds.includes(c.kind)) && (!matches || matches(changedIds([c])) || ownedBy(c)));
}
