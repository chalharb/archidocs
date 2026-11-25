import type { Bundle, BundleDynamicView, BundleStructuralView, BundleView } from "../../schema/bundle.ts";
import { resolveDynamic, takesPart, type DynamicResolution, type ResolvedDynamicView } from "./dynamic.ts";
import { generatedViewIds, resolveGenerated, summarise } from "./generated.ts";
import { applyLens } from "./lens.ts";
import { ModelIndex } from "./model.ts";
import { resolveSaved, type SavedResolution } from "./saved.ts";
import type { ListedKind, ResolvedView, ResolveOptions, ViewSummary } from "./types.ts";

/** Any View resolved: a Structural View, or a Dynamic View (`kind: "dynamic"`). */
export type AnyView = ResolvedView | ResolvedDynamicView;

/**
 * Resolves any View by its id: a Generated View (`c1`, `c2`, `c2/<system>`,
 * `c3/<service>`, only for a Service with Components, or `deployment/<env>`)
 * or a Saved View (`project:view-id`), structural or dynamic. The two are
 * told apart by `kind`; the options apply to a Structural View only. Returns
 * undefined for an unknown id.
 */
export function resolveView(bundle: Bundle, id: string, options: ResolveOptions = {}): AnyView | undefined {
  const saved = bundle.views.find((v) => v.id === id);
  if (saved?.kind === "dynamic") return resolveDynamic(bundle, saved).view;
  return resolveStructural(bundle, new ModelIndex(bundle), id, options);
}

/** Resolves a Structural View by id over an index of its Bundle; undefined for an unknown id or a Dynamic View's. */
export function resolveStructural(bundle: Bundle, model: ModelIndex, id: string, options: ResolveOptions = {}): ResolvedView | undefined {
  const lens = options.lens ?? "own";
  const view = unlensed(bundle, model, id, options.expand ?? [], lens === "own");
  if (view && typeof lens === "object") applyLens(bundle, model, view, lens);
  return view;
}

/** A Structural View without any Lens but, when `own` is set, a Saved View's own. */
function unlensed(bundle: Bundle, model: ModelIndex, id: string, expand: readonly string[], own: boolean): ResolvedView | undefined {
  const saved = bundle.views.find((v) => v.id === id);
  if (saved) return saved.kind === "structural" ? resolveSaved(bundle, model, own ? saved : { ...saved, lens: null }).view : undefined;
  return resolveGenerated(bundle, model, id, expand);
}

/**
 * Resolves one Saved View's definition with what `check` reports about it: a
 * Structural View's `expand` and `collapse` entries that can't apply and its
 * paths that find nothing, or a Dynamic View's Step problems.
 */
export function checkView(bundle: Bundle, def: BundleStructuralView): SavedResolution;
export function checkView(bundle: Bundle, def: BundleDynamicView): DynamicResolution;
export function checkView(bundle: Bundle, def: BundleView): SavedResolution | DynamicResolution {
  return def.kind === "dynamic" ? resolveDynamic(bundle, def) : resolveSaved(bundle, new ModelIndex(bundle), def);
}

/**
 * The picked nodes of a View, laid out again on their own: each pick with the
 * containers it sits in, and the edges among them, Lens marks kept.
 */
export function pickedView(view: ResolvedView, picks: readonly string[]): ResolvedView {
  const parentOf = new Map(view.nodes.map((n) => [n.id, n.parent]));
  const kept = new Set<string>();
  for (const pick of picks) for (let at: string | null | undefined = parentOf.has(pick) ? pick : undefined; at; at = parentOf.get(at)) kept.add(at);
  return { ...view, nodes: view.nodes.filter((n) => kept.has(n.id)), edges: view.edges.filter((e) => kept.has(e.from) && kept.has(e.to)) };
}

/**
 * Every Generated View, in the order `c1`, `c2`, then `c2/<system>` and
 * `c3/<service>` by id, then `deployment/<env>` by Environment id, then every
 * Saved View by id. `kind` keeps one kind; `element` keeps the Views that
 * show that Element as a node or a Deployment, and the
 * Dynamic Views it takes part in (including as the broker of an event Step).
 */
export function listViews(bundle: Bundle, filter: { kind?: ListedKind; element?: string } = {}): ViewSummary[] {
  const model = new ModelIndex(bundle);
  const ids = generatedViewIds(bundle).filter((id) => filter.kind === undefined || summarise(id, bundle).kind === filter.kind);
  const generated: ViewSummary[] = filter.element === undefined ? ids.map((id) => summarise(id, bundle)) : resolveAll(bundle, model, ids).filter((v) => shows(v, filter.element!));
  const element = filter.element;
  const saved = bundle.views
    .map((v) => ({ v, kind: v.kind === "dynamic" ? ("dynamic" as const) : v.level }))
    .filter(({ kind }) => filter.kind === undefined || kind === filter.kind)
    .filter(({ v }) => {
      if (element === undefined) return true;
      if (v.kind === "dynamic") return takesPart(resolveDynamic(bundle, v).view, element);
      return shows(resolveSaved(bundle, model, v).view, element);
    })
    .map(({ v, kind }) => ({ id: v.id, kind, title: v.title }));
  return [...generated, ...saved].map(({ id, kind, title }) => ({ id, kind, title }));
}

/** Whether a View draws an Element, as a node of its own or as a Deployment of it. */
const shows = (view: ResolvedView, element: string) => view.nodes.some((n) => n.id === element || (n.kind === "deployment" && n.element === element));

/** Every Generated View, resolved, in `listViews` order. */
export function generatedViews(bundle: Bundle): ResolvedView[] {
  return resolveAll(bundle, new ModelIndex(bundle), generatedViewIds(bundle));
}

/** Resolves each id, skipping any that don't resolve (as when a Workspace with errors declares one id twice). */
const resolveAll = (bundle: Bundle, model: ModelIndex, ids: string[]) => ids.map((id) => resolveStructural(bundle, model, id)).filter((v) => v !== undefined);
