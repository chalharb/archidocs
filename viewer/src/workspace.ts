import { formatViewId, listViews, ownViewId, parseViewId, resolveView, type ResolvedView, type ResolveOptions, type ViewSummary } from "../../src/core/views/index.ts";
import { teamStyles, type TeamStyle } from "../../src/render/teams.ts";
import type { Bundle, BundleElement, BundleTarget } from "../../src/schema/bundle.ts";

export interface Crumb {
  label: string;
  /** The View a crumb opens; none for a heading such as Saved or a Project. */
  view?: string;
}

/** One row of a rail tree: a label, what picking it does, and the rows nested under it. */
export interface TreeRow {
  key: string;
  label: string;
  /** An Element's id, or a View's id, or null for a group heading. */
  element?: string;
  view?: string;
  glyph?: string;
  team?: TeamStyle;
  children: TreeRow[];
}

/** Resolves a View the screen draws as boxes: a Structural View, or undefined for a Dynamic View's id or an unknown one. */
export function structuralView(bundle: Bundle, id: string, options: ResolveOptions): ResolvedView | undefined {
  const view = resolveView(bundle, id, options);
  return view?.kind === "dynamic" ? undefined : view;
}

/** The Element a Generated View focuses on (`c2/<system>` or `c3/<service>`), else undefined. */
export function focusOf(view: string): string | undefined {
  const ref = parseViewId(view);
  return ref?.form === "focused" ? ref.element : undefined;
}

const byName = (a: { id: string; name: string }, b: { id: string; name: string }) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export const GLYPHS: Record<BundleElement["kind"], string> = { person: "◉", system: "▣", service: "▭", component: "◇" };

/** Lookups over a loaded Bundle that the screens share. */
export class Workspace {
  readonly bundle: Bundle;
  readonly byId: Map<string, BundleElement>;
  readonly targets: Map<string, BundleTarget>;
  readonly teams: Map<string, TeamStyle>;
  readonly views: ViewSummary[];
  private readonly childrenOf = new Map<string | null, BundleElement[]>();
  private readonly viewIds: Set<string>;

  /** The Workspace's name, as `archidocs export` writes it in a picture's source line. */
  readonly workspaceName: string;

  constructor(bundle: Bundle, workspaceName = "Workspace") {
    this.bundle = bundle;
    this.workspaceName = workspaceName;
    this.byId = new Map(bundle.elements.map((e) => [e.id, e]));
    this.targets = new Map(bundle.targets.map((t) => [t.id, t]));
    this.teams = teamStyles(bundle);
    this.views = listViews(bundle);
    this.viewIds = new Set(this.views.map((v) => v.id));
    for (const e of bundle.elements) {
      const list = this.childrenOf.get(e.parent) ?? [];
      list.push(e);
      this.childrenOf.set(e.parent, list);
    }
    for (const list of this.childrenOf.values()) list.sort(byName);
  }

  children(id: string | null): BundleElement[] {
    return this.childrenOf.get(id) ?? [];
  }

  /** The Element's ancestors, top level first, without the Element. */
  ancestors(id: string): string[] {
    const out: string[] = [];
    for (let p = this.byId.get(id)?.parent ?? null; p !== null && !out.includes(p); p = this.byId.get(p)?.parent ?? null) out.unshift(p);
    return out;
  }

  title(view: string): string | undefined {
    return this.views.find((v) => v.id === view)?.title;
  }

  /** A Dynamic View's description as written, if it has one. */
  description(view: string): string | null {
    const def = this.bundle.views.find((v) => v.id === view);
    return def?.description ?? null;
  }

  name(id: string): string {
    return this.byId.get(id)?.name ?? [...this.bundle.teams, ...this.bundle.environments].find((t) => t.id === id)?.name ?? id;
  }

  /** The View a box is the way into: its own C2 or C3, when the Workspace has one. */
  wayIn(id: string): string | undefined {
    const own = ownViewId(this.bundle, id);
    return own !== undefined && focusOf(own) === id && this.viewIds.has(own) ? own : undefined;
  }

  /** The Views one step down the scope ladder from a View: C1 to the C2 Landscape, that to each System, a System to each Service with Components. */
  deeper(view: string): { label: string; view: string }[] {
    if (view === "c1") return this.viewIds.has("c2") ? [{ label: "C2 Landscape", view: "c2" }] : [];
    const ref = parseViewId(view);
    const inside = ref?.form === "landscape" ? this.children(null).filter((e) => e.kind === "system") : ref?.form === "focused" && ref.level === "c2" ? this.children(ref.element) : [];
    return inside.flatMap((e) => {
      const own = this.wayIn(e.id);
      return own === undefined ? [] : [{ label: e.name, view: own }];
    });
  }

  /** The Environments a Service has Deployments in, in the Bundle's order, each with its Deployment View and the nodes there that draw them. */
  deployedIn(service: string): { environment: string; label: string; view: string; nodes: string[] }[] {
    return this.bundle.environments
      .map((env) => ({ environment: env.id, label: env.name, view: formatViewId({ form: "deployment", environment: env.id }) }))
      .map((e) => ({ ...e, nodes: structuralView(this.bundle, e.view, { lens: "none" })?.nodes.filter((n) => n.kind === "deployment" && n.element === service).map((n) => n.id) ?? [] }))
      .filter((e) => e.nodes.length > 0);
  }

  /** The scope ladder up to a View: C1 › C2 Landscape › System › Service; a Deployment View hangs off C1. */
  crumbs(view: string): Crumb[] {
    const saved = this.bundle.views.find((v) => v.id === view);
    if (saved) return [{ label: "Saved" }, { label: this.bundle.projects.find((p) => p.id === saved.project)?.name ?? saved.project }, { label: saved.title, view }];
    const ladder: Crumb[] = [{ label: "C1", view: "c1" }];
    if (view === "c1") return ladder;
    const ref = parseViewId(view);
    if (ref?.form === "deployment") return [...ladder, { label: this.title(view) ?? view, view }];
    ladder.push({ label: "C2 Landscape", view: "c2" });
    const focus = ref?.form === "focused" ? this.byId.get(ref.element) : undefined;
    if (!focus) return ladder;
    const system = [...this.ancestors(focus.id), focus.id].map((id) => this.byId.get(id)!).find((e) => e.kind === "system");
    if (system) ladder.push({ label: system.name, view: formatViewId({ form: "focused", level: "c2", element: system.id }) });
    if (ref?.form === "focused" && ref.level === "c3") ladder.push({ label: focus.name, view });
    return ladder;
  }

  /** The Model tree by kind: People, Systems, External Systems and Services outside any System, each nesting its children. */
  modelByKind(): TreeRow[] {
    const top = this.children(null);
    const groups: [string, BundleElement[]][] = [
      ["People", top.filter((e) => e.kind === "person")],
      ["Systems", top.filter((e) => e.kind === "system" && !e.external)],
      ["External Systems", top.filter((e) => e.kind === "system" && e.external)],
      ["Services", top.filter((e) => e.kind === "service")],
    ];
    return groups.filter(([, list]) => list.length > 0).map(([label, list]) => ({ key: `kind:${label}`, label, children: list.map((e) => this.elementRow(e, () => true)) }));
  }

  /** The Model tree by Team: what each Team owns; an Element owned by another Team than its parent shows under its own Team. */
  modelByTeam(): TreeRow[] {
    return [...this.bundle.teams]
      .sort(byName)
      .map((team) => {
        const roots = this.bundle.elements.filter((e) => e.owner === team.id && (e.parent === null || this.byId.get(e.parent)?.owner !== team.id)).sort(byName);
        return { key: `team:${team.id}`, label: team.name, team: this.teams.get(team.id), children: roots.map((e) => this.elementRow(e, (c) => c.owner === team.id)) };
      })
      .filter((row) => row.children.length > 0);
  }

  private elementRow(e: BundleElement, keep: (child: BundleElement) => boolean): TreeRow {
    return {
      key: e.id,
      label: e.name,
      element: e.id,
      glyph: GLYPHS[e.kind],
      team: this.teams.get(e.owner),
      children: this.children(e.id).filter(keep).map((c) => this.elementRow(c, keep)),
    };
  }

  /** The Views tree by kind: Landscapes, then Systems with the C3 Views of their Services nested. */
  viewsByKind(): TreeRow[] {
    return [
      { key: "views:landscapes", label: "Landscapes", children: this.landscapeRows() },
      ...this.systemViewGroup("Systems", () => true),
      { key: "views:deployment", label: "Deployment", children: this.deploymentRows() },
      { key: "views:dynamic", label: "Dynamic Views", children: this.dynamicRows(() => true) },
      { key: "views:saved", label: "Saved Views", children: this.savedByProject() },
    ].filter((g) => g.children.length > 0);
  }

  /** The Views tree by Team: the Landscapes under Workspace, then each Team's C2 and C3 Views. */
  viewsByTeam(): TreeRow[] {
    const teams = [...this.bundle.teams].sort(byName).flatMap((team) => {
      const [group] = this.systemViewGroup(team.name, (owner) => owner === team.id, team.id);
      return [{ ...group!, children: [...group!.children, ...this.dynamicRows((owner) => owner === team.id, team.id), ...this.savedRows((owner) => owner === team.id, team.id)] }];
    });
    return [{ key: "views:workspace", label: "Workspace", children: [...this.landscapeRows(), ...this.deploymentRows()] }, ...teams].filter((g) => g.children.length > 0);
  }

  private landscapeRows(): TreeRow[] {
    return this.views.filter((v) => parseViewId(v.id)?.form === "landscape").map((v) => ({ key: v.id, label: v.title, view: v.id, children: [] }));
  }

  /** The Saved structural Views the viewer can draw, one group per Project, by Project name. */
  private savedByProject(): TreeRow[] {
    return [...this.bundle.projects]
      .sort(byName)
      .map((p) => ({ key: `views:saved:${p.id}`, label: p.name, children: this.savedRows(() => true, undefined, p.id) }))
      .filter((g) => g.children.length > 0);
  }

  /** The Saved structural Views whose Project a kept Team owns (and is `project`, when given), by title. */
  private savedRows(keep: (owner: string) => boolean, team?: string, project?: string): TreeRow[] {
    const owner = new Map(this.bundle.projects.map((p) => [p.id, p.owner]));
    return this.bundle.views
      .filter((v) => v.kind === "structural" && (project === undefined || v.project === project) && keep(owner.get(v.project) ?? ""))
      .filter((v) => structuralView(this.bundle, v.id, { lens: "none" }) !== undefined)
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
      .map((v) => ({ key: v.id, label: v.title, view: v.id, glyph: "◇", team: team ? this.teams.get(team) : undefined, children: [] }));
  }

  /** One row per Environment's Deployment View, which no Team owns. */
  private deploymentRows(): TreeRow[] {
    return this.views.filter((v) => parseViewId(v.id)?.form === "deployment").map((v) => ({ key: v.id, label: v.title, view: v.id, glyph: "⛁", children: [] }));
  }

  /** The Dynamic Views whose Project a kept Team owns, by title. */
  private dynamicRows(keep: (owner: string) => boolean, team?: string): TreeRow[] {
    const owner = new Map(this.bundle.projects.map((p) => [p.id, p.owner]));
    return this.bundle.views
      .filter((v) => v.kind === "dynamic" && keep(owner.get(v.project) ?? ""))
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
      .map((v) => ({ key: v.id, label: v.title, view: v.id, glyph: "▶", team: team ? this.teams.get(team) : undefined, children: [] }));
  }

  /** Each kept System's C2 View with its Services' C3 Views nested, then C3 Views of Services outside any kept System. */
  private systemViewGroup(label: string, keep: (owner: string) => boolean, team?: string): TreeRow[] {
    const row = (v: ViewSummary): TreeRow => ({ key: v.id, label: v.title, view: v.id, team: team ? this.teams.get(team) : undefined, children: [] });
    // Only Generated Views (`c2/<system>`, `c3/<service>`); a Saved View drawn at c2 or c3 is listed under Saved Views.
    const focused = (level: "c2" | "c3") =>
      this.views.filter((v) => {
        const ref = parseViewId(v.id);
        return ref?.form === "focused" && ref.level === level && keep(this.byId.get(ref.element)?.owner ?? "");
      });
    const c3 = focused("c3");
    const nested = new Set<string>();
    const systems = focused("c2").map((v) => {
      const children = c3.filter((s) => this.ancestors(focusOf(s.id)!).includes(focusOf(v.id)!));
      for (const c of children) nested.add(c.id);
      return { ...row(v), children: children.map(row) };
    });
    const loose = c3.filter((v) => !nested.has(v.id)).map(row);
    const children = [...systems, ...loose].sort((a, b) => a.label.localeCompare(b.label));
    return [{ key: `views:${label}`, label, team: team ? this.teams.get(team) : undefined, children }];
  }
}
