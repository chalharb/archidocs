/**
 * Convert the editor document into React Flow nodes and edges.
 *
 * React Flow positions child nodes relative to their parent, while the editor
 * document (and `.layout.yaml`) uses absolute coordinates (ADD-006); this is the
 * only place the two meet. Every rendered node keeps its canonical entity
 * reference and every edge its relationship reference (DIAG-08).
 */
import type { Edge, Node } from "@xyflow/react";
import type { ResolvedEdge, ResolvedNode } from "@/domain/diagram-resolve";
import type { EdgeType } from "@/domain/resources";
import type { EditorDoc } from "./state";

export interface ElementNodeData extends Record<string, unknown> {
  node: ResolvedNode;
}

export interface ArchEdgeData extends Record<string, unknown> {
  edge: ResolvedEdge;
  edgeType: EdgeType;
  animated: boolean;
}

export type ArchFlowNode = Node<ElementNodeData, "element" | "boundary">;
export type ArchFlowEdge = Edge<ArchEdgeData, "arch">;

function depthOf(byId: Map<string, ResolvedNode>, id: string): number {
  let depth = 0;
  const seen = new Set<string>([id]);
  let current = byId.get(id)?.boundary;
  while (current !== undefined && byId.has(current) && !seen.has(current)) {
    depth++;
    seen.add(current);
    current = byId.get(current)!.boundary;
  }
  return depth;
}

export function toFlowNodes(
  nodes: readonly ResolvedNode[],
  doc: EditorDoc,
  options: { selected?: ReadonlySet<string> } = {},
): ArchFlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isBoundary = new Set(
    nodes.map((n) => n.boundary).filter((b): b is string => b !== undefined && byId.has(b)),
  );
  const ordered = nodes
    .map((n, i) => ({ n, i, depth: depthOf(byId, n.id) }))
    .filter(({ n }) => doc.boxes[n.id])
    .sort((a, b) => a.depth - b.depth || a.i - b.i);
  return ordered.map(({ n }) => {
    const box = doc.boxes[n.id]!;
    const parent = n.boundary !== undefined ? doc.boxes[n.boundary] : undefined;
    const position = parent ? { x: box.x - parent.x, y: box.y - parent.y } : { x: box.x, y: box.y };
    return {
      id: n.id,
      type: isBoundary.has(n.id) ? "boundary" : "element",
      position,
      width: box.width,
      height: box.height,
      ...(parent ? { parentId: n.boundary } : {}),
      selected: options.selected?.has(n.id) ?? false,
      data: { node: n },
      ariaLabel: `${n.label} (${n.entityType})`,
    } satisfies ArchFlowNode;
  });
}

export function toFlowEdges(
  edges: readonly ResolvedEdge[],
  presentation: (edgeId: string) => { edgeType: EdgeType; animated: boolean },
  options: { selected?: string | null; nodeIds?: ReadonlySet<string> } = {},
): ArchFlowEdge[] {
  return edges
    .filter(
      (e) => !options.nodeIds || (options.nodeIds.has(e.source) && options.nodeIds.has(e.target)),
    )
    .map((e) => {
      const p = presentation(e.id);
      return {
        id: e.id,
        type: "arch",
        source: e.source,
        target: e.target,
        selected: options.selected === e.id,
        data: { edge: e, edgeType: p.edgeType, animated: p.animated },
        ariaLabel: `${e.label ?? e.relationshipType}: ${e.source} to ${e.target}`,
      } satisfies ArchFlowEdge;
    });
}
