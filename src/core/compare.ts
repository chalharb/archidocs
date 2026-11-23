import type { Bundle, BundleDeployment } from "../schema/bundle.ts";
import { diff } from "./diff.ts";
import { ModelIndex, resolveView, type ResolveOptions, type ResolvedView } from "./views.ts";

/** How Compare marks a node or edge of a View between two Bundles. */
export type CompareMark = "added" | "removed" | "changed" | "unchanged";

const withoutSource = (item: object) => {
  const { source: _source, ...rest } = item as { source?: unknown };
  return JSON.stringify(rest);
};

/** Items of both sides, each once: the later side's where both have it. */
function union<T>(before: T[], after: T[], key: (item: T) => string): T[] {
  const keys = new Set(after.map(key));
  return [...after, ...before.filter((item) => !keys.has(key(item)))];
}

const byId = (item: { id: string }) => item.id;
const deploymentKey = (d: BundleDeployment) => `${d.service}\0${d.environment}\0${d.target}`;

/**
 * One Bundle holding everything either side holds, the later side's version
 * where both do, so a View drawn from it keeps removed things in place.
 * Relationships are matched by their whole content, so a changed one shows
 * at both sides; each lands on the same edge.
 */
export function unionBundle(before: Bundle, after: Bundle): Bundle {
  return {
    ...after,
    teams: union(before.teams, after.teams, byId),
    environments: union(before.environments, after.environments, byId),
    projects: union(before.projects, after.projects, byId),
    elements: union(before.elements, after.elements, byId),
    relationships: union(before.relationships, after.relationships, withoutSource),
    targets: union(before.targets, after.targets, byId),
    deployments: union(before.deployments, after.deployments, deploymentKey),
    views: union(before.views, after.views, byId),
    adrs: union(before.adrs, after.adrs, byId),
  };
}

/**
 * A View for Compare: laid out over the union of both sides, with every node
 * and edge marked. A node or edge only the later side's View shows is
 * added, one only the earlier side's shows is removed. One both show is
 * changed when its Element changed, or for a collapsed box when anything
 * inside it was added, removed or changed; an edge when its Relationships
 * did. A View that exists at one side only is drawn from that side.
 * Undefined when neither side has the View.
 */
export function compareView(before: Bundle, after: Bundle, id: string, options: Pick<ResolveOptions, "expand"> = {}): ResolvedView | undefined {
  const view = resolveView(unionBundle(before, after), id, options);
  if (!view) return undefined;
  const [b, a] = [resolveView(before, id, options), resolveView(after, id, options)];
  const changed = new Set(diff(before, after).filter((c) => c.kind === "element").map((c) => c.id));
  const model = new ModelIndex(unionBundle(before, after));
  const holdsChange = (nodeId: string) => [...changed].some((c) => c !== nodeId && model.ancestry(c).includes(nodeId));
  const sides = <T>(list: (v: ResolvedView) => T[], key: (item: T) => string) => [b, a].map((v) => new Map((v ? list(v) : []).map((x) => [key(x), x])));
  const [bNodes, aNodes] = sides((v) => v.nodes, (n) => n.id);
  const edgeKey = (e: { from: string; to: string }) => `${e.from}\0${e.to}`;
  const [bEdges, aEdges] = sides((v) => v.edges, edgeKey);

  const mark = (inBefore: boolean, inAfter: boolean, isChanged: () => boolean): CompareMark =>
    inAfter && !inBefore ? "added" : inBefore && !inAfter ? "removed" : isChanged() ? "changed" : "unchanged";
  for (const node of view.nodes) {
    node.change = mark(bNodes!.has(node.id), aNodes!.has(node.id), () => changed.has(node.id) || (node.collapsed && holdsChange(node.id)));
  }
  const relationships = (e: { relationships: object[] } | undefined) => (e?.relationships.map(withoutSource).sort() ?? []).join("\n");
  for (const edge of view.edges) {
    const key = edgeKey(edge);
    edge.change = mark(bEdges!.has(key), aEdges!.has(key), () => relationships(bEdges!.get(key)) !== relationships(aEdges!.get(key)));
  }
  return view;
}
