import type { Bundle, BundleSelector, BundleStructuralView } from "../../schema/bundle.ts";
import { getImpact } from "../impact.ts";
import { pathsBetween } from "../paths.ts";
import { lifter, type Level } from "../query.ts";
import { resolveDeployment } from "./deployment.ts";
import { applyLens, nodesOn } from "./lens.ts";
import { build, type ModelIndex } from "./model.ts";
import type { ResolvedView, ViewKind } from "./types.ts";

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

const levelOf: Record<Exclude<ViewKind, "deployment">, Level> = { c1: "system", c2: "service", c3: "component" };

/**
 * Resolves a Saved structural View:
 * 1. union the `include` selectors (every Element when there is no `include`);
 * 2. subtract the `exclude` selectors, an excluded Element taking everything inside it;
 * 3. collapse every Element to `level`;
 * 4. open each `expand` Element one level deeper, then close each `collapse` Element;
 * 5. derive edges, leaving out Relationships of excluded Elements.
 * The Lens marks nodes and lights edges but never changes membership.
 * A Deployment View is resolved by `savedDeployment` instead.
 */
export function resolveSaved(bundle: Bundle, model: ModelIndex, def: BundleStructuralView): SavedResolution {
  if (def.level === "deployment") return savedDeployment(bundle, model, def);
  const kind = def.level;
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

/**
 * Resolves a Saved Deployment View over its `environment`: `include` and
 * `exclude` select Services (a System or Component selects the Services in
 * it or holding it), and `targets` keeps the Deployments in those Target
 * subtrees. A Service that is selected but has no Deployment kept is drawn,
 * when related, as a logical node; an excluded one is left out altogether.
 * `expand` and `collapse` don't apply to a Deployment View.
 */
function savedDeployment(bundle: Bundle, model: ModelIndex, def: BundleStructuralView): SavedResolution {
  const unresolvedPaths: UnresolvedPath[] = [];
  const services = (selectors: BundleSelector[], field: string) => {
    const ids = new Set<string>();
    selectors.forEach((s, i) => {
      const found = selected(bundle, model, s);
      if (found.unresolved) unresolvedPaths.push({ at: [field, i], ...found.unresolved });
      for (const id of found.ids) {
        for (const e of model.elements) if (e.kind === "service" && (model.ancestry(e.id).includes(id) || model.ancestry(id).includes(e.id))) ids.add(e.id);
      }
    });
    return ids;
  };
  const included = def.include === null ? undefined : services(def.include, "include");
  const excluded = services(def.exclude, "exclude");
  const parentOf = new Map(bundle.targets.map((t) => [t.id, t.parent]));
  const under = (target: string) => {
    for (let t: string | null | undefined = target; t; t = parentOf.get(t)) if (def.targets.includes(t)) return true;
    return false;
  };
  const view = resolveDeployment(bundle, model, { id: def.id, title: def.title }, def.environment ?? "", {
    keep: (s) => !excluded.has(s),
    deployed: (d) => (included === undefined || included.has(d.service)) && (def.targets.length === 0 || under(d.target)),
  });
  if (def.direction !== null) view.direction = def.direction;
  if (def.lens !== null) {
    const lensed = applyLens(bundle, model, view, def.lens);
    if (lensed.unresolved) unresolvedPaths.push({ at: ["lens", "path"], ...lensed.unresolved });
  }
  return { view, badExpand: [], unresolvedPaths };
}

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
