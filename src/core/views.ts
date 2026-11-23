import type { Bundle, BundleElement, BundleLens, BundleRelationship } from "../schema/bundle.ts";
import { resolveDynamic, takesPart } from "./dynamic-views.ts";
import { applyLens, resolveSaved } from "./saved-views.ts";

/** The most nodes a View may have before `oversized-view` warns. */
export const MAX_VIEW_NODES = 150;

/** The kinds of Generated structural View. */
export type ViewKind = "c1" | "c2" | "c3";

/** One node of a resolved View: an Element, drawn as a box or as a container. */
export interface ViewNode {
  id: string;
  kind: BundleElement["kind"];
  name: string;
  /** The nearest ancestor that is itself a node of this View, else null. */
  parent: string | null;
  /** True when the Element has children in the Model that this View hides inside it. */
  collapsed: boolean;
  /** True for an External System or Service. */
  external: boolean;
  /** Set on every node of a View with a Lens: whether the Lens hits it, and for an impact Lens its nearest distance. */
  mark?: NodeMark;
}

/** How a Lens marks a node; a collapsed box is hit when anything inside it is. */
export interface NodeMark {
  hit: boolean;
  distance?: number;
}

/** A Saved View's drawing direction. */
export type ViewDirection = "TB" | "BT" | "LR" | "RL";

/** An edge between two nodes, with the declared Relationships beneath it. */
export interface ViewEdge {
  from: string;
  to: string;
  relationships: BundleRelationship[];
  /** Set on every edge of a View with a Lens: whether the Lens lights it. */
  lit?: boolean;
}

/** A View resolved to nodes and edges, sorted by id and by `from`, then `to`. */
export interface ResolvedView {
  id: string;
  kind: ViewKind;
  title: string;
  /** A Saved View's own direction, if it sets one. */
  direction?: ViewDirection;
  /** A Saved View's Lens, if it carries one. */
  lens?: BundleLens;
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface ResolveOptions {
  /**
   * Systems and Services to open, showing their children; viewer state, not a
   * different View. A box opens only while it is itself shown, so a Service
   * stays shut inside a closed System. C1 opens nothing.
   */
  expand?: readonly string[];
  /**
   * A Lens over the View, as the viewer holds it: marks nodes and lights
   * edges without changing which nodes the View holds. It replaces a Saved
   * View's own Lens.
   */
  lens?: BundleLens;
}

/**
 * Resolves a View by id: a Generated View (`c1`, `c2`, `c2/<system>` or
 * `c3/<service>`, only for a Service with Components) or a Saved structural
 * View (`project:view-id`). Returns undefined for an unknown id, and for a
 * Saved Deployment View, which this resolver can't draw yet.
 */
export function resolveView(bundle: Bundle, id: string, options: ResolveOptions = {}): ResolvedView | undefined {
  const view = resolveUnlensed(bundle, id, options);
  if (view && options.lens) applyLens(bundle, new ModelIndex(bundle), view, options.lens);
  return view;
}

function resolveUnlensed(bundle: Bundle, id: string, options: ResolveOptions): ResolvedView | undefined {
  const saved = bundle.views.find((v) => v.id === id);
  if (saved) return saved.kind === "structural" ? resolveSaved(bundle, saved)?.view : undefined;
  const model = new ModelIndex(bundle);
  if (id === "c1") return landscape(model, "c1", "C1 Landscape", []);
  if (id === "c2") return landscape(model, "c2", "C2 Landscape", options.expand ?? []);
  const slash = id.indexOf("/");
  if (slash < 0) return undefined;
  const scope = id.slice(0, slash);
  const focus = model.byId.get(id.slice(slash + 1));
  if (!focus) return undefined;
  const expand = options.expand ?? [];
  if (scope === "c2" && focus.kind === "system") return focused(model, { id, kind: "c2", title: `${focus.name} (C2)` }, focus, expand);
  if (scope === "c3" && focus.kind === "service" && model.children(focus.id).length > 0) return focused(model, { id, kind: "c3", title: `${focus.name} (C3)` }, focus, expand);
  return undefined;
}

/** The kinds a View is listed under: a Saved structural View's is its `level`. */
export type ListedKind = ViewKind | "deployment" | "dynamic";

/** A View as listed, without its nodes and edges. */
export interface ViewSummary {
  id: string;
  kind: ListedKind;
  title: string;
}

/**
 * Every Generated View, in the order `c1`, `c2`, then `c2/<system>` and
 * `c3/<service>` by id, then every Saved View by id. `kind` keeps one kind;
 * `element` keeps the Views that show that Element as a node, and the
 * Dynamic Views it takes part in (including as the broker of an event Step).
 */
export function listViews(bundle: Bundle, filter: { kind?: ListedKind; element?: string } = {}): ViewSummary[] {
  const ids = generatedViewIds(bundle).filter((id) => filter.kind === undefined || id.split("/")[0] === filter.kind);
  const generated: ViewSummary[] = filter.element === undefined ? ids.map((id) => summarise(id, bundle)) : resolveAll(bundle, ids).filter((v) => v.nodes.some((n) => n.id === filter.element));
  const element = filter.element;
  const saved = bundle.views
    .map((v) => ({ v, kind: v.kind === "dynamic" ? ("dynamic" as const) : v.level }))
    .filter(({ kind }) => filter.kind === undefined || kind === filter.kind)
    .filter(({ v }) => {
      if (element === undefined) return true;
      if (v.kind === "dynamic") return takesPart(resolveDynamic(bundle, v).view, element);
      return resolveSaved(bundle, v)?.view.nodes.some((n) => n.id === element);
    })
    .map(({ v, kind }) => ({ id: v.id, kind, title: v.title }));
  return [...generated, ...saved].map(({ id, kind, title }) => ({ id, kind, title }));
}

/** Every Generated View, resolved, in `listViews` order. */
export function generatedViews(bundle: Bundle): ResolvedView[] {
  return resolveAll(bundle, generatedViewIds(bundle));
}

/** Resolves each id, skipping any that don't resolve (as when a Workspace with errors declares one id twice). */
const resolveAll = (bundle: Bundle, ids: string[]) => ids.map((id) => resolveView(bundle, id)).filter((v) => v !== undefined);

function generatedViewIds(bundle: Bundle): string[] {
  const parents = new Set(bundle.elements.map((e) => e.parent));
  const ids = (prefix: string, keep: (e: BundleElement) => boolean) => [...new Set(bundle.elements.filter(keep).map((e) => `${prefix}/${e.id}`))].sort();
  return ["c1", "c2", ...ids("c2", (e) => e.kind === "system"), ...ids("c3", (e) => e.kind === "service" && parents.has(e.id))];
}

/** A Generated View's id, kind and title without resolving it; `id` must be one `generatedViewIds` gave. */
function summarise(id: string, bundle: Bundle): ViewSummary & { kind: ViewKind } {
  if (id === "c1") return { id, kind: "c1", title: "C1 Landscape" };
  if (id === "c2") return { id, kind: "c2", title: "C2 Landscape" };
  const [kind, elementId] = [id.slice(0, 2) as ViewKind, id.slice(3)];
  return { id, kind, title: `${bundle.elements.find((e) => e.id === elementId)!.name} (${kind.toUpperCase()})` };
}

/** Every top-level Element, each standing for everything beneath it, with the `expand`ed boxes open. */
function landscape(model: ModelIndex, kind: ViewKind, title: string, expand: readonly string[]): ResolvedView {
  const shown = new Set(model.elements.filter((e) => e.parent === null).map((e) => e.id));
  open(model, shown, expand);
  return build(model, { id: kind, kind, title }, shown, () => true);
}

/** Adds the children of each `expand`ed System or Service that is shown, repeating so a Service opens once its System has. */
function open(model: ModelIndex, shown: Set<string>, expand: readonly string[]): void {
  const pending = new Set(expand.filter((id) => ["system", "service"].includes(model.byId.get(id)?.kind ?? "")));
  for (let grew = true; grew; ) {
    grew = false;
    for (const id of pending) {
      if (!shown.has(id)) continue;
      for (const child of model.children(id)) shown.add(child.id);
      pending.delete(id);
      grew = true;
    }
  }
}

/**
 * One Element opened as a container around its children, plus its direct
 * neighbours: every Element outside it with a Relationship to anything
 * inside it, collapsed to its highest ancestor that does not contain the
 * focus. Only Relationships touching the focus become edges.
 */
function focused(model: ModelIndex, head: Pick<ResolvedView, "id" | "kind" | "title">, focus: BundleElement, expand: readonly string[]): ResolvedView {
  const inside = (id: string) => model.ancestry(id).includes(focus.id);
  const touches = (r: BundleRelationship) => inside(r.from) || inside(r.to);
  const shown = new Set([focus.id, ...model.children(focus.id).map((c) => c.id)]);
  for (const r of model.relationships) {
    if (!touches(r)) continue;
    for (const end of [r.from, r.to]) {
      if (inside(end) || !model.byId.has(end)) continue;
      const separating = model.ancestry(end).filter((a) => !model.ancestry(focus.id).includes(a));
      shown.add(separating.at(-1)!);
    }
  }
  open(model, shown, expand);
  return build(model, head, shown, touches);
}

/**
 * Builds a View from the set of Elements it shows: each Relationship's ends
 * are lifted to their nearest shown ancestor-or-self, and the Relationships
 * landing on one pair form one edge. An edge is kept when `keep` accepts the
 * declared Relationship and its ends are two different nodes.
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
  return { ...head, nodes, edges: [...edges.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to)) };
}

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

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
