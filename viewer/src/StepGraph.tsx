import { Controls, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { memo, useEffect, useMemo } from "react";
import type { ResolvedDynamicView, ResolvedView, ViewEdge } from "../../src/core/views/index.ts";
import { sequenceMessages, sequenceParticipants, type SequenceMessage } from "../../src/render/sequence.ts";
import { useLayout } from "./layout.ts";
import type { Workspace } from "./workspace.ts";
import { CtrlWheelZoom } from "./wheel.tsx";

export interface StepGraphProps {
  workspace: Workspace;
  view: ResolvedDynamicView;
  brokers: boolean;
  fitKey: string;
  selected: number | null;
  onSelect: (n: number) => void;
  onSettled: (fitKey: string) => void;
}

/** A pair of participants joined by Steps, in the direction of the call: a return is folded onto the call it answers. */
interface Pair {
  from: string;
  to: string;
  messages: SequenceMessage[];
}

/**
 * The Steps of a Dynamic View as a numbered graph: one node per participant,
 * one edge per pair of participants carrying the numbers of every Step
 * between them, laid out by the same elk layout as the structural Views.
 */
export function stepGraph(workspace: Workspace, view: ResolvedDynamicView, brokers: boolean): { graph: ResolvedView; pairs: Pair[] } {
  const pairs = new Map<string, Pair>();
  for (const m of sequenceMessages(view, { brokers })) {
    const [from, to] = m.style === "return" ? [m.to, m.from] : [m.from, m.to];
    const key = `${from}>${to}`;
    const pair = pairs.get(key) ?? { from, to, messages: [] };
    pair.messages.push(m);
    pairs.set(key, pair);
  }
  const nodes = sequenceParticipants(view, { brokers }).map((id) => {
    const element = workspace.byId.get(id);
    return { id, kind: element?.kind ?? "service", name: workspace.name(id), parent: null, collapsed: false, external: element !== undefined && "external" in element && element.external };
  });
  const edges: ViewEdge[] = [...pairs.values()].map((p) => ({ from: p.from, to: p.to, relationships: [...new Set(p.messages.map((m) => m.step.relationship))] }));
  return { graph: { id: view.id, kind: "c2", title: view.title, direction: "LR", nodes, edges }, pairs: [...pairs.values()] };
}

interface GraphNodeData extends Record<string, unknown> {
  name: string;
}

interface GraphEdgeData extends Record<string, unknown> {
  points: { x: number; y: number }[];
  pair: Pair;
  selected: number | null;
  onSelect: (n: number) => void;
}

export function StepGraph(props: StepGraphProps) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}

function Graph({ workspace, view, brokers, fitKey, selected, onSelect, onSettled }: StepGraphProps) {
  const { graph, pairs } = useMemo(() => stepGraph(workspace, view, brokers), [workspace, view, brokers]);
  const { laidOut, error } = useLayout(graph);
  const layout = laidOut?.view === graph ? laidOut.layout : undefined;

  const nodes = useMemo<Node<GraphNodeData>[]>(
    () =>
      layout?.nodes.map((box) => ({
        id: box.id,
        type: "participant",
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        style: { width: box.width, height: box.height },
        draggable: false,
        connectable: false,
        data: { name: workspace.name(box.id) },
      })) ?? [],
    [layout, workspace],
  );
  const edges = useMemo<Edge<GraphEdgeData>[]>(() => {
    if (!layout) return [];
    const byKey = new Map(pairs.map((p) => [`${p.from}>${p.to}`, p]));
    const first = (p: Pair) => p.messages[0]!.n;
    return layout.edges
      .map((e) => ({ e, pair: byKey.get(`${e.from}>${e.to}`)! }))
      .sort((a, b) => first(a.pair) - first(b.pair))
      .map(({ e, pair }) => ({
        id: `${e.from}>${e.to}`,
        source: e.from,
        target: e.to,
        type: "steps",
        selectable: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        data: { points: e.points, pair, selected, onSelect },
      }));
  }, [layout, pairs, selected, onSelect]);

  if (error) return <p className="arc-error">Layout failed: {error}</p>;
  return (
    <ReactFlow
      className="arc-flow arc-graph"
      nodes={nodes}
      edges={edges}
      // Figma's pattern, for mouse and trackpad alike: scroll pans 1:1 (Shift turns a mouse wheel sideways),
      // pinch or ⌘/Ctrl with the wheel zooms, and a left- or middle-button drag on the background pans.
      panOnScroll
      panOnScrollSpeed={1}
      panOnDrag={[0, 1]}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.05}
      maxZoom={2}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Controls showInteractive={false} />
      {layout && <GraphFitter width={layout.width} height={layout.height} edges={layout.edges.length} fitKey={fitKey} onSettled={onSettled} />}
      <CtrlWheelZoom />
    </ReactFlow>
  );
}

function GraphFitter({ width, height, edges, fitKey, onSettled }: { width: number; height: number; edges: number; fitKey: string; onSettled: (fitKey: string) => void }) {
  const { setViewport } = useReactFlow();
  const w = useStore((s) => s.width);
  const h = useStore((s) => s.height);
  useEffect(() => {
    if (w === 0 || h === 0) return;
    const pad = 32;
    const zoom = Math.min(1, (w - 2 * pad) / Math.max(width, 1), (h - 2 * pad) / Math.max(height, 1));
    void setViewport({ x: (w - width * zoom) / 2, y: (h - height * zoom) / 2, zoom });
    let frame = 0;
    const whenDrawn = () => {
      if (document.querySelectorAll("path[data-edge-from]").length >= edges) onSettled(fitKey);
      else frame = window.requestAnimationFrame(whenDrawn);
    };
    frame = window.requestAnimationFrame(whenDrawn);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, fitKey, w > 0 && h > 0]);
  return null;
}

const Participant = memo(function Participant({ id, data }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div className="arc-box arc-graph-node" data-graph-node={id}>
      <Handle type="target" position={Position.Left} isConnectable={false} className="arc-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="arc-handle" />
      <div className="arc-text">
        <div className="arc-name">{data.name}</div>
      </div>
    </div>
  );
});

/** A pair's edge with one numbered badge per Step along it; a badge selects its Step. */
function Steps({ data, markerEnd }: EdgeProps<Edge<GraphEdgeData>>) {
  const { points, pair, selected, onSelect } = data!;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const mid = Math.floor((points.length - 1) / 2);
  const [a, b] = [points[mid]!, points[mid + 1] ?? points[mid]!];
  const lit = pair.messages.some((m) => m.n === selected);
  return (
    <>
      <path className={lit ? "arc-edge arc-lit" : "arc-edge"} d={d} fill="none" markerEnd={markerEnd} data-edge-from={pair.from} data-edge-to={pair.to} />
      <EdgeLabelRenderer>
        <div className="arc-graph-steps nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)` }}>
          {pair.messages.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`arc-graph-step arc-step-${m.style}`}
              data-graph-step={m.key}
              aria-pressed={m.n === selected}
              title={m.label}
              onClick={() => onSelect(m.n)}
            >
              {m.key}
            </button>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { participant: Participant };
const edgeTypes = { steps: Steps };
