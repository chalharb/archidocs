import type { Bundle, BundleElement } from "../schema/bundle.ts";
import { cmp, within } from "./query.ts";

export type OwnedKind = BundleElement["kind"] | "target";

/** One thing a Team owns, with how many other Teams sit upstream and downstream of it. */
export interface OwnedItem {
  id: string;
  name: string;
  parent: string | null;
  upstreamTeams: number;
  downstreamTeams: number;
}

export interface OwnedGroup {
  kind: OwnedKind;
  total: number;
  items: OwnedItem[];
}

export interface OwnedResult {
  team: string;
  kind: OwnedKind | null;
  total: number;
  groups: OwnedGroup[];
}

const kinds: OwnedKind[] = ["person", "system", "service", "component", "target"];

/**
 * The Elements and Deployment Targets `team` owns, grouped by kind in the
 * order Person, System, Service, Component, Target, each sorted by id. An
 * Element is listed under its own Owner, whoever owns its parent.
 *
 * For an Element, Upstream Teams own the consumers of Relationships into it
 * or its descendants, and Downstream Teams own their providers; a `via`
 * broker is a provider of both the consumer and the provider. For a Target,
 * Upstream Teams own the Deployments on it or the Targets beneath it, and
 * Downstream Teams own the Targets above it. The Team itself is never
 * counted.
 */
export function listOwned(bundle: Bundle, team: string, kind?: OwnedKind): OwnedResult {
  const ownerOf = new Map([...bundle.elements, ...bundle.targets].map((e) => [e.id, e.owner]));
  const inside = within(bundle);
  const others = (ids: Iterable<string>) => new Set([...ids].map((id) => ownerOf.get(id)).filter((o) => o && o !== team)).size;

  const elementItem = (e: BundleElement): OwnedItem => {
    const up = new Set<string>();
    const down = new Set<string>();
    const ins = (x: string | null) => x !== null && inside(x, e.id);
    for (const r of bundle.relationships) {
      if (ins(r.from) && !ins(r.to)) down.add(r.to);
      if (ins(r.to) && !ins(r.from)) up.add(r.from);
      if (r.via && !ins(r.via) && (ins(r.from) || ins(r.to))) down.add(r.via);
      if (ins(r.via)) for (const x of [r.from, r.to]) if (!ins(x)) up.add(x);
    }
    return { id: e.id, name: e.name, parent: e.parent, upstreamTeams: others(up), downstreamTeams: others(down) };
  };

  const targetParent = new Map(bundle.targets.map((t) => [t.id, t.parent]));
  const underTarget = (id: string, root: string) => {
    for (let at: string | null | undefined = id; at; at = targetParent.get(at)) if (at === root) return true;
    return false;
  };
  const targetItem = (t: Bundle["targets"][number]): OwnedItem => {
    const deployers = new Set(bundle.deployments.filter((d) => underTarget(d.target, t.id)).map((d) => d.owner));
    const beneath = bundle.targets.filter((x) => x.id !== t.id && underTarget(x.id, t.id)).map((x) => x.owner);
    const above = new Set<string>();
    for (let at = t.parent; at; at = targetParent.get(at) ?? null) above.add(ownerOf.get(at) ?? "");
    const count = (owners: Iterable<string>) => new Set([...owners].filter((o) => o && o !== team)).size;
    return { id: t.id, name: t.name, parent: t.parent, upstreamTeams: count([...deployers, ...beneath]), downstreamTeams: count(above) };
  };

  const groups: OwnedGroup[] = [];
  for (const k of kinds) {
    if (kind && k !== kind) continue;
    const items =
      k === "target"
        ? bundle.targets.filter((t) => t.owner === team).map(targetItem)
        : bundle.elements.filter((e) => e.kind === k && e.owner === team).map(elementItem);
    items.sort((a, b) => cmp(a.id, b.id));
    if (items.length) groups.push({ kind: k, total: items.length, items });
  }
  return { team, kind: kind ?? null, total: groups.reduce((n, g) => n + g.total, 0), groups };
}
