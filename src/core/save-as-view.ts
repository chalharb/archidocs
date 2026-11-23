import { stringify } from "yaml";
import type { Bundle, BundleLens, BundleSelector, BundleStructuralView } from "../schema/bundle.ts";
import { resolveSaved } from "./saved-views.ts";
import { ModelIndex, pickedView, resolveView, type ViewDirection, type ViewKind } from "./views.ts";

/** What the viewer shows, as its URL holds it: the View, its open boxes, the Lens, the picks and a turned direction. */
export interface Screen {
  view: string;
  open: readonly string[];
  lens: BundleLens | null;
  picks: readonly string[];
  /** The direction the viewer turned the View to; null keeps the View's own. */
  direction: ViewDirection | null;
}

/** A Saved View definition as written under `views: structural: <id>:`, every id qualified. */
export type SavedViewDefinition = Record<string, unknown> & { title: string; level: string };

export interface SavedScreen {
  definition: SavedViewDefinition;
  /** The definition as Project YAML, under `views: structural:`. */
  yaml: string;
  /** The `upsert_view` MCP call that writes the same definition. */
  call: { tool: "upsert_view"; arguments: { project: string; id: string; definition: SavedViewDefinition } };
}

type Level = Exclude<ViewKind, "deployment">;
const kindLevel: Record<string, Level> = { person: "c1", system: "c1", service: "c2", component: "c3" };
const levelDepth: Record<Level, number> = { c1: 1, c2: 2, c3: 3 };

/**
 * Save as View: turns the screen into a Saved View definition that the core
 * engine resolves to the same nodes. The picks (with their open containers),
 * or else every node, become ids; open boxes whose children are all kept
 * become `expand`; the Lens becomes an include selector (an Impact Lens
 * `upstream`/`downstream: all`, a Team Lens `{team}`, Connect to… a path
 * selector) and is kept as `lens:`. Nodes the Lens selector would add beyond
 * the screen are excluded. A Saved View with no picks keeps its own selectors.
 * A Deployment View is saved whole, over its Environment, its Lens as `lens:`.
 */
export function saveAsView(bundle: Bundle, screen: Screen, target: { project: string; id: string; title: string }): SavedScreen {
  const view = resolveView(bundle, screen.view, { expand: screen.open });
  if (!view) throw new Error(`No View ${screen.view} to save.`);
  const own = bundle.views.find((v): v is BundleStructuralView => v.id === screen.view && v.kind === "structural");
  const direction = screen.direction ?? own?.direction ?? null;
  const lens = screen.lens ? { lens: writtenLens(screen.lens) } : {};

  let body: Record<string, unknown>;
  if (view.kind === "deployment" && screen.picks.length > 0) throw new Error("Save as View keeps a whole Deployment View; clear the picks first.");
  if (view.kind === "deployment" && !own) {
    body = { level: "deployment", environment: screen.view.slice("deployment/".length) };
  } else if (own && screen.picks.length === 0) {
    body = {
      level: own.level,
      ...(own.include === null ? {} : { include: own.include }),
      ...nonEmpty({ exclude: own.exclude, expand: own.expand, collapse: own.collapse, targets: own.targets }),
      ...(own.environment === null ? {} : { environment: own.environment }),
    };
  } else {
    const model = new ModelIndex(bundle);
    const kept = new Set((screen.picks.length === 0 ? view : pickedView(view, screen.picks)).nodes.map((n) => n.id));

    const depthOf = (id: string) => model.ancestry(id).length;
    const expand = screen.open
      .filter((id) => kept.has(id) && model.children(id).length > 0 && model.children(id).every((c) => kept.has(c.id)))
      .sort((a, b) => depthOf(a) - depthOf(b));
    const byExpand = new Set(expand.flatMap((id) => model.children(id).map((c) => c.id)));
    const ids = [...kept].filter((id) => !byExpand.has(id)).sort();
    const deepest = ids.reduce((d, id) => Math.max(d, levelDepth[kindLevel[model.byId.get(id)!.kind]!]), levelDepth[view.kind as Level]);
    const level = (Object.keys(levelDepth) as Level[]).find((l) => levelDepth[l] === deepest)!;

    const plain = { level, include: ids, ...nonEmpty({ expand }) };
    const selector = screen.lens ? lensSelector(screen.lens) : undefined;
    body = plain;
    if (selector) {
      const reached = nodesOf(bundle, { level, include: [selector] });
      const include = [selector, ...ids.filter((id) => !reached.has(id))];
      const extra = [...nodesOf(bundle, { level, include, expand })].filter((id) => !kept.has(id)).sort();
      const withLens = { level, include, ...nonEmpty({ exclude: extra, expand }) };
      if (sameSet(nodesOf(bundle, withLens), kept)) body = withLens;
    }
  }

  const definition = localise({ title: target.title, ...body, ...(direction === null ? {} : { direction }), ...lens }, target.project) as SavedViewDefinition;
  return {
    definition,
    yaml: stringify({ views: { structural: { [target.id]: definition } } }, { flowCollectionPadding: true }),
    call: { tool: "upsert_view", arguments: { project: target.project, id: target.id, definition } },
  };
}

/** Writes the target Project's own ids bare, as Load wants them inside that Project; Team and Environment ids are never qualified. */
function localise(value: unknown, project: string, key?: string): unknown {
  if (typeof value === "string") return key === "team" || key === "environment" || key === "title" || key === "level" || key === "direction" ? value : value.startsWith(`${project}:`) ? value.slice(project.length + 1) : value;
  if (Array.isArray(value)) return value.map((v) => localise(v, project));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localise(v, project, k)]));
  return value;
}

const nonEmpty = (lists: Record<string, readonly unknown[]>) => Object.fromEntries(Object.entries(lists).filter(([, list]) => list.length > 0));

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** The Lens as an include selector: the Elements it reaches. */
function lensSelector(lens: BundleLens): BundleSelector {
  if ("team" in lens) return { team: lens.team };
  if ("path" in lens) return { from: lens.path.from, to: lens.path.to, paths: lens.path.paths ?? "shortest" };
  const ways = lens.direction === "both" ? (["upstream", "downstream"] as const) : [lens.direction];
  return { element: lens.impact, ...Object.fromEntries(ways.map((w) => [w, "all"])) };
}

function writtenLens(lens: BundleLens): Record<string, unknown> {
  if ("path" in lens) return { path: { from: lens.path.from, to: lens.path.to, paths: lens.path.paths ?? "shortest" } };
  return { ...lens };
}

/** The node ids the core engine resolves a definition to. */
function nodesOf(bundle: Bundle, def: { level: Level; include: BundleSelector[]; exclude?: BundleSelector[]; expand?: string[] }): Set<string> {
  const resolved = resolveSaved(bundle, {
    id: "screen:saved",
    project: "screen",
    kind: "structural",
    title: "",
    description: null,
    tags: [],
    level: def.level,
    include: def.include,
    exclude: def.exclude ?? [],
    expand: def.expand ?? [],
    collapse: [],
    direction: null,
    lens: null,
    environment: null,
    targets: [],
    source: { file: "", line: 0 },
  });
  return new Set(resolved?.view.nodes.map((n) => n.id) ?? []);
}
