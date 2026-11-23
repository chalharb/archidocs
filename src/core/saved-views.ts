import type { Bundle, BundleLens, BundleRelationship, BundleSelector, BundleView } from "../schema/bundle.ts";
import { getImpact } from "./impact.ts";
import { pathsBetween, type Path } from "./paths.ts";
import { lifter, type Level } from "./query.ts";
import { build, ModelIndex, type ResolvedView, type ViewKind } from "./views.ts";

/** An `expand` or `collapse` entry that can't apply: its id is not a node of the View, or it has no children. */
export interface BadExpand {
  field: "expand" | "collapse";
  index: number;
  id: string;
  reason: "not-in-view" | "no-children";
}

/** A path selector, or a path Lens, that finds no path. */
export interface UnresolvedPath {
  /** Where it is written: `["include", 2]`, `["exclude", 0]` or `["lens", "path"]`. */
  at: [string, string | number];
  from: string;
  to: string;
}

/** A Saved View resolved, with what `check` reports about it. */
export interface SavedResolution {
  view: ResolvedView;
  badExpand: BadExpand[];
  unresolvedPaths: UnresolvedPath[];
}

const levelOf: Record<ViewKind, Level> = { c1: "system", c2: "service", c3: "component" };

/**
 * Resolves a Saved structural View:
 * 1. union the `include` selectors (every Element when there is no `include`);
 * 2. subtract the `exclude` selectors, an excluded Element taking everything inside it;
 * 3. collapse every Element to `level`;
 * 4. open each `expand` Element one level deeper, then close each `collapse` Element;
 * 5. derive edges, leaving out Relationships of excluded Elements.
 * The Lens marks nodes and lights edges but never changes membership.
 * Returns undefined for a Deployment View, which is not resolved here yet.
 */
export function resolveSaved(bundle: Bundle, def: BundleView): SavedResolution | undefined {
  if (def.level === "deployment") return undefined;
  const kind = def.level;
  const model = new ModelIndex(bundle);
  const unresolvedPaths: UnresolvedPath[] = [];
  const select = (selectors: BundleSelector[], field: string) => {
    const ids = new Set<string>();
    selectors.forEach((s, i) => {
      const found = selected(bundle, model, s);
      if (found.unresolved) unresolvedPaths.push({ at: [field, i], ...found.unresolved });
      for (const id of found.ids) ids.add(id);
    });
    return ids;
  };

  const members = def.include === null ? new Set(model.elements.map((e) => e.id)) : select(def.include, "include");
  const excluded = select(def.exclude, "exclude");
  const isExcluded = (id: string) => model.ancestry(id).some((a) => excluded.has(a));
  const lift = lifter(bundle, levelOf[kind]);
  const shown = new Set([...members].filter((id) => !isExcluded(id)).map(lift));

  const badExpand: BadExpand[] = [];
  for (const field of ["expand", "collapse"] as const) {
    def[field].forEach((id, index) => {
      const children = model.children(id);
      if (!shown.has(id)) badExpand.push({ field, index, id, reason: "not-in-view" });
      else if (children.length === 0) badExpand.push({ field, index, id, reason: "no-children" });
      else if (field === "expand") for (const c of children) shown.add(c.id);
      else for (const n of [...shown]) if (n !== id && model.ancestry(n).includes(id)) shown.delete(n);
    });
  }

  const view = build(model, { id: def.id, kind, title: def.title }, shown, (r) => !isExcluded(r.from) && !isExcluded(r.to));
  if (def.direction !== null) view.direction = def.direction;
  if (def.lens !== null) {
    const lensed = applyLens(bundle, model, view, def.lens);
    if (lensed.unresolved) unresolvedPaths.push({ at: ["lens", "path"], ...lensed.unresolved });
  }
  return { view, badExpand, unresolvedPaths };
}

/** A Lens in words, for tool text and a picture's key. */
export const describeLens = (lens: BundleLens): string =>
  "impact" in lens ? `impact of ${lens.impact}, ${lens.direction}` : "team" in lens ? `Team ${lens.team}` : `paths from ${lens.path.from} to ${lens.path.to} (${lens.path.paths ?? "shortest"})`;

type Found = { ids: Set<string>; unresolved?: { from: string; to: string } };

/** The Elements one selector names; unknown ids name none (`unknown-element` reports them). */
function selected(bundle: Bundle, model: ModelIndex, s: BundleSelector): Found {
  if (typeof s === "string") return { ids: new Set(model.byId.has(s) ? [s] : []) };
  if ("team" in s) return { ids: new Set(model.elements.filter((e) => e.owner === s.team).map((e) => e.id)) };
  if ("tag" in s) return { ids: new Set(model.elements.filter((e) => e.tags.includes(s.tag)).map((e) => e.id)) };
  if ("from" in s) {
    const paths = pathsBetween(bundle, s.from, s.to, s.paths ?? "shortest");
    const known = model.byId.has(s.from) && model.byId.has(s.to);
    return { ids: nodesOn(paths), ...(known && paths.length === 0 ? { unresolved: { from: s.from, to: s.to } } : {}) };
  }
  const ids = new Set<string>();
  if (!model.byId.has(s.element)) return { ids };
  ids.add(s.element);
  const below = (id: string, deep: boolean) => {
    for (const c of model.children(id)) {
      ids.add(c.id);
      if (deep) below(c.id, deep);
    }
  };
  if (s.with) below(s.element, s.with === "descendants");
  for (const direction of ["upstream", "downstream"] as const) {
    const hops = s[direction];
    if (hops === undefined || hops === 0) continue;
    const impact = getImpact(bundle, s.element, direction, hops === "all" ? {} : { maxDepth: hops });
    for (const ring of impact[direction] ?? []) for (const e of ring.elements) ids.add(e.id);
  }
  return { ids };
}

const nodesOn = (paths: Path[]) => new Set(paths.flatMap((p) => p.hops.flatMap((h) => [h.from, h.to])));

/**
 * Marks every node and lights every edge for the Lens. An Element the Lens
 * reaches marks the node that holds it, or that it holds, at its nearest
 * distance. An impact Lens lights an edge carrying the impact one hop
 * closer to its origin; a path Lens, an edge carrying a hop of a path; a
 * Team Lens, an edge between two hit nodes.
 */
export function applyLens(bundle: Bundle, model: ModelIndex, view: ResolvedView, lens: BundleLens): { unresolved?: { from: string; to: string } } {
  view.lens = lens;
  /** Element ids the Lens reaches, with their distance when it has one. */
  const reached = new Map<string, number | undefined>();
  const carried = new Set<BundleRelationship>();
  let unresolved: { from: string; to: string } | undefined;

  if ("impact" in lens) {
    if (model.byId.has(lens.impact)) {
      reached.set(lens.impact, 0);
      const impact = getImpact(bundle, lens.impact, lens.direction);
      for (const ring of [...(impact.upstream ?? []), ...(impact.downstream ?? [])]) {
        for (const e of ring.elements) {
          reached.set(e.id, Math.min(reached.get(e.id) ?? Infinity, ring.distance));
          for (const r of e.relationships) carried.add(r);
        }
      }
    }
  } else if ("team" in lens) {
    for (const e of model.elements) if (e.owner === lens.team) reached.set(e.id, undefined);
  } else {
    const paths = pathsBetween(bundle, lens.path.from, lens.path.to, lens.path.paths ?? "shortest");
    for (const id of nodesOn(paths)) reached.set(id, undefined);
    for (const p of paths) for (const h of p.hops) for (const r of h.relationships) carried.add(r);
    if (paths.length === 0 && model.byId.has(lens.path.from) && model.byId.has(lens.path.to)) unresolved = { from: lens.path.from, to: lens.path.to };
  }

  // Each reached Element marks the nearest node holding it; an impact or path Lens also marks the nodes inside it.
  const shown = new Set(view.nodes.map((n) => n.id));
  const marks = new Map(view.nodes.map((n) => [n.id, { hit: false } as { hit: boolean; distance?: number }]));
  const mark = (node: string | undefined, d: number | undefined) => {
    const m = node === undefined ? undefined : marks.get(node);
    if (!m) return;
    m.hit = true;
    if (d !== undefined) m.distance = Math.min(m.distance ?? Infinity, d);
  };
  for (const [id, d] of reached) {
    mark(model.ancestry(id).find((a) => shown.has(a)), d);
    if (!("team" in lens)) for (const n of view.nodes) if (n.id !== id && model.ancestry(n.id).includes(id)) mark(n.id, d);
  }
  for (const n of view.nodes) n.mark = marks.get(n.id)!;

  const markOf = new Map(view.nodes.map((n) => [n.id, n.mark!]));
  for (const e of view.edges) {
    const [from, to] = [markOf.get(e.from)!, markOf.get(e.to)!];
    if ("team" in lens) e.lit = from.hit && to.hit;
    else if ("impact" in lens) e.lit = e.relationships.some((r) => carried.has(r)) && from.distance !== undefined && to.distance !== undefined && Math.abs(from.distance - to.distance) === 1;
    else e.lit = e.relationships.some((r) => carried.has(r)) && from.hit && to.hit;
  }
  return unresolved ? { unresolved } : {};
}
