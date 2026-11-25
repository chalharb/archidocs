import type { Bundle } from "../../schema/bundle.ts";
import { unionBundle, withoutSource } from "../compare.ts";
import { diff } from "../diff.ts";
import { ModelIndex } from "./model.ts";
import { resolveStructural } from "./resolve.ts";
import type { CompareMark, ResolveOptions, ResolvedView } from "./types.ts";

/**
 * A View for Compare: laid out over the union of both sides, with every node
 * and edge marked. A node or edge only the later side's View shows is
 * added, one only the earlier side's shows is removed. One both show is
 * changed when its Element changed, or for a collapsed box when anything
 * inside it was added, removed or changed; an edge when its Relationships
 * did. A View that exists at one side only is drawn from that side.
 * Undefined when neither side has the View. The options are `resolveView`'s.
 */
export function compareView(before: Bundle, after: Bundle, id: string, options: ResolveOptions = {}): ResolvedView | undefined {
  const both = unionBundle(before, after);
  const model = new ModelIndex(both);
  const view = resolveStructural(both, model, id, options);
  if (!view) return undefined;
  const [b, a] = [before, after].map((side) => resolveStructural(side, new ModelIndex(side), id, options));
  const changed = new Set(diff(before, after).filter((c) => c.kind === "element").map((c) => c.id));
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
