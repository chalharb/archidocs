import type { Bundle, BundleLens, BundleRelationship } from "../../schema/bundle.ts";
import { getImpact } from "../impact.ts";
import { pathsBetween, type Path } from "../paths.ts";
import type { ModelIndex } from "./model.ts";
import type { ImpactSide, NodeMark, ResolvedView } from "./types.ts";

/** A Lens in words, for tool text and a picture's key. */
export const describeLens = (lens: BundleLens): string =>
  "impact" in lens ? `impact of ${lens.impact}, ${lens.direction}` : "team" in lens ? `Team ${lens.team}` : `paths from ${lens.path.from} to ${lens.path.to} (${lens.path.paths ?? "shortest"})`;

/** Every Element on any of the paths. */
export const nodesOn = (paths: Path[]) => new Set(paths.flatMap((p) => p.hops.flatMap((h) => [h.from, h.to])));

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
  /** For an impact Lens, which side of the origin each reached Element is on, at its nearest distance. */
  const sides = new Map<string, ImpactSide>();
  const carried = new Set<BundleRelationship>();
  let unresolved: { from: string; to: string } | undefined;

  if ("impact" in lens) {
    if (model.byId.has(lens.impact)) {
      reached.set(lens.impact, 0);
      sides.set(lens.impact, "origin");
      const impact = getImpact(bundle, lens.impact, lens.direction);
      const rings = [...(impact.upstream ?? []).map((ring) => ["upstream", ring] as const), ...(impact.downstream ?? []).map((ring) => ["downstream", ring] as const)];
      for (const [side, ring] of rings) {
        for (const e of ring.elements) {
          if (ring.distance < (reached.get(e.id) ?? Infinity)) {
            reached.set(e.id, ring.distance);
            sides.set(e.id, side);
          }
          for (const r of e.relationships) carried.add(r);
        }
      }
    }
  } else if ("team" in lens) {
    for (const e of model.elements) if (e.owner === lens.team) reached.set(e.id, undefined);
    for (const t of bundle.targets) if (t.owner === lens.team) reached.set(t.id, undefined);
  } else {
    const paths = pathsBetween(bundle, lens.path.from, lens.path.to, lens.path.paths ?? "shortest");
    for (const id of nodesOn(paths)) reached.set(id, undefined);
    for (const p of paths) for (const h of p.hops) for (const r of h.relationships) carried.add(r);
    if (paths.length === 0 && model.byId.has(lens.path.from) && model.byId.has(lens.path.to)) unresolved = { from: lens.path.from, to: lens.path.to };
  }

  // Each reached Element marks the nearest node holding it; an impact or path Lens also marks the nodes inside it.
  // A node stands for its own id, or for the Element it draws: a Deployment View draws one Service as several Deployments.
  const standing = new Map<string, string[]>();
  for (const n of view.nodes) standing.set(n.element ?? n.id, [...(standing.get(n.element ?? n.id) ?? []), n.id]);
  const marks = new Map(view.nodes.map((n) => [n.id, { hit: false } as NodeMark]));
  const mark = (node: string, d: number | undefined, side: ImpactSide | undefined) => {
    const m = marks.get(node);
    if (!m) return;
    m.hit = true;
    if (d !== undefined && d < (m.distance ?? Infinity)) {
      m.distance = d;
      if (side !== undefined) m.side = side;
    }
  };
  for (const [id, d] of reached) {
    const holder = model.ancestry(id).find((a) => standing.has(a));
    for (const n of holder === undefined ? [] : standing.get(holder)!) mark(n, d, sides.get(id));
    if (!("team" in lens)) for (const n of view.nodes) if ((n.element ?? n.id) !== id && model.ancestry(n.element ?? n.id).includes(id)) mark(n.id, d, sides.get(id));
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
