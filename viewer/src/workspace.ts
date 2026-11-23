import { listViews, resolveView, type ResolvedView, type ViewSummary } from "../../src/core/views.ts";
import { teamStyles, type TeamStyle } from "../../src/render/teams.ts";
import type { Bundle, BundleElement } from "../../src/schema/bundle.ts";

export interface Crumb {
  label: string;
  view: string;
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

const byName = (a: { id: string; name: string }, b: { id: string; name: string }) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export const GLYPHS: Record<BundleElement["kind"], string> = { person: "☺", system: "▣", service: "▢", component: "▫" };

/** Lookups over a loaded Bundle that the screens share. */
export class Workspace {
  readonly bundle: Bundle;
  readonly byId: Map<string, BundleElement>;
  readonly teams: Map<string, TeamStyle>;
  readonly views: ViewSummary[];
  private readonly childrenOf = new Map<string | null, BundleElement[]>();
  private readonly viewIds: Set<string>;

  constructor(bundle: Bundle) {
    this.bundle = bundle;
    this.byId = new Map(bundle.elements.map((e) => [e.id, e]));
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

  resolve(view: string, open: readonly string[]): ResolvedView | undefined {
    return resolveView(this.bundle, view, { expand: open });
  }

  /** A box's own Generated View: C3 for a Service with Components, else its System's C2. */
  ownView(id: string): string | undefined {
    const element = this.byId.get(id);
    if (!element) return undefined;
    if (element.kind === "system") return `c2/${id}`;
    if (element.kind === "service" && this.viewIds.has(`c3/${id}`)) return `c3/${id}`;
    const system = this.ancestors(id).find((a) => this.byId.get(a)?.kind === "system");
    return system === undefined ? undefined : `c2/${system}`;
  }

  /** The scope ladder up to a View: C1 › C2 Landscape › System › Service. */
  crumbs(view: string): Crumb[] {
    const ladder: Crumb[] = [{ label: "C1", view: "c1" }];
    if (view === "c1") return ladder;
    ladder.push({ label: "C2 Landscape", view: "c2" });
    const focus = view.includes("/") ? this.byId.get(view.slice(3)) : undefined;
    if (!focus) return ladder;
    const system = [...this.ancestors(focus.id), focus.id].map((id) => this.byId.get(id)!).find((e) => e.kind === "system");
    if (system) ladder.push({ label: system.name, view: `c2/${system.id}` });
    if (view.startsWith("c3/")) ladder.push({ label: focus.name, view });
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
    return [{ key: "views:landscapes", label: "Landscapes", children: this.landscapeRows() }, ...this.systemViewGroup("Systems", () => true)].filter((g) => g.children.length > 0);
  }

  /** The Views tree by Team: the Landscapes under Workspace, then each Team's C2 and C3 Views. */
  viewsByTeam(): TreeRow[] {
    const teams = [...this.bundle.teams].sort(byName).flatMap((team) => this.systemViewGroup(team.name, (owner) => owner === team.id, team.id));
    return [{ key: "views:workspace", label: "Workspace", children: this.landscapeRows() }, ...teams].filter((g) => g.children.length > 0);
  }

  private landscapeRows(): TreeRow[] {
    // Dynamic Views get their own screen (ticket 20); until then they stay out of the tree.
    return this.views.filter((v) => v.kind !== "c3" && v.kind !== "dynamic" && !v.id.includes("/")).map((v) => ({ key: v.id, label: v.title, view: v.id, children: [] }));
  }

  /** Each kept System's C2 View with its Services' C3 Views nested, then C3 Views of Services outside any kept System. */
  private systemViewGroup(label: string, keep: (owner: string) => boolean, team?: string): TreeRow[] {
    const row = (v: ViewSummary): TreeRow => ({ key: v.id, label: v.title, view: v.id, team: team ? this.teams.get(team) : undefined, children: [] });
    const c3 = this.views.filter((v) => v.kind === "c3" && keep(this.byId.get(v.id.slice(3))!.owner));
    const nested = new Set<string>();
    const systems = this.views
      .filter((v) => v.kind === "c2" && v.id.includes("/") && keep(this.byId.get(v.id.slice(3))!.owner))
      .map((v) => {
        const children = c3.filter((s) => this.ancestors(s.id.slice(3)).includes(v.id.slice(3)));
        for (const c of children) nested.add(c.id);
        return { ...row(v), children: children.map(row) };
      });
    const loose = c3.filter((v) => !nested.has(v.id)).map(row);
    const children = [...systems, ...loose].sort((a, b) => a.label.localeCompare(b.label));
    return [{ key: `views:${label}`, label, team: team ? this.teams.get(team) : undefined, children }];
  }
}
