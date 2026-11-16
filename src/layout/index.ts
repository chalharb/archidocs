import ElkModule from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api.js";

// The bundled build is CommonJS; its default export is the engine class.
const ELK = ElkModule as unknown as new () => { layout(graph: ElkNode): Promise<ElkNode> };

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface PlacedNode extends LayoutNode {
  x: number;
  y: number;
}

/** Places nodes automatically. Runs at build time only; the viewer never loads the layout engine. */
export async function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<PlacedNode[]> {
  const elk = new ELK();
  const result = await elk.layout({
    id: "root",
    layoutOptions: { "elk.algorithm": "layered", "elk.direction": "RIGHT" },
    children: nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  return nodes.map((n) => {
    const placed = result.children?.find((c: ElkNode) => c.id === n.id);
    return { ...n, x: placed?.x ?? 0, y: placed?.y ?? 0 };
  });
}
