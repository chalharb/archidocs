import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { ViewNode } from "../../src/core/views.ts";
import type { TeamStyle } from "../../src/render/teams.ts";
import type { LaidOut } from "./layout.ts";
import type { Workspace } from "./workspace.ts";

/** Animated transitions run up to this many nodes, and never with `prefers-reduced-motion`. */
export const ANIMATE_MAX_NODES = 100;
const DURATION = 300;
/** Below this zoom, sub-labels and Team codes hide. */
export const DETAIL_ZOOM = 0.45;

export interface CanvasProps {
  workspace: Workspace;
  laidOut: LaidOut;
  selected: string | null;
  open: readonly string[];
  /** Changes when the screen should fit the drawing again, such as a new View or direction. */
  fitKey: string;
  onSelect: (id: string | null) => void;
  onToggle: (id: string, open: boolean) => void;
  onOpenView: (id: string) => void;
  /** Called once a Layout is fitted to the screen and any transition has finished. */
  onSettled: (laidOut: LaidOut) => void;
}

interface BoxData extends Record<string, unknown> {
  node: ViewNode;
  sublabel: string;
  team: TeamStyle | undefined;
  container: boolean;
  /** `+` when collapsed with children to show, `−` when opened by the viewer, else neither. */
  toggle: "expand" | "collapse" | null;
  onToggle: (id: string, open: boolean) => void;
}

interface RouteData extends Record<string, unknown> {
  points: { x: number; y: number }[];
  faded: boolean;
  from: string;
  to: string;
}

const KIND_LABEL: Record<ViewNode["kind"], string> = { person: "Person", system: "System", service: "Service", component: "Component" };

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

function Flow({ workspace, laidOut, selected, open, fitKey, onSelect, onToggle, onOpenView, onSettled }: CanvasProps) {
  const { view, layout } = laidOut;
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion && view.nodes.length <= ANIMATE_MAX_NODES;
  const zoomedOut = useStore((s) => s.transform[2] < DETAIL_ZOOM);

  const nodes = useMemo<Node<BoxData>[]>(() => {
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    const containers = new Set(view.nodes.map((n) => n.parent).filter((p) => p !== null));
    const depth = (id: string): number => {
      const parent = byId.get(id)?.parent ?? null;
      return parent === null ? 0 : 1 + depth(parent);
    };
    return layout.nodes.map((box) => {
      const node = byId.get(box.id)!;
      const element = workspace.byId.get(box.id);
      const technology = element && "technology" in element ? element.technology : null;
      const canOpen = view.kind !== "c1" && node.collapsed && (node.kind === "system" || node.kind === "service");
      return {
        id: box.id,
        type: "box",
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        style: { width: box.width, height: box.height },
        zIndex: depth(box.id),
        selected: box.id === selected,
        draggable: false,
        connectable: false,
        data: {
          node,
          sublabel: [node.external ? `External ${KIND_LABEL[node.kind].toLowerCase()}` : KIND_LABEL[node.kind], technology].filter(Boolean).join(" · "),
          team: element ? workspace.teams.get(element.owner) : undefined,
          container: containers.has(box.id),
          toggle: canOpen ? "expand" : open.includes(box.id) ? "collapse" : null,
          onToggle,
        },
      };
    });
  }, [view, layout, workspace, selected, open, onToggle]);

  const edges = useMemo<Edge<RouteData>[]>(
    () =>
      layout.edges.map((e) => ({
        id: `${e.from}>${e.to}`,
        source: e.from,
        target: e.to,
        type: "route",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        selectable: false,
        data: { points: e.points, faded: selected !== null && e.from !== selected && e.to !== selected, from: e.from, to: e.to },
      })),
    [layout, selected],
  );

  return (
    <ReactFlow
      className={["ad-flow", animate ? "ad-animate" : "", zoomedOut ? "ad-zoomed-out" : ""].filter(Boolean).join(" ")}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.05}
      maxZoom={2}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => onSelect(node.id)}
      onNodeDoubleClick={(_, node) => onOpenView(node.id)}
      onPaneClick={() => onSelect(null)}
    >
      <Controls showInteractive={false} />
      <Fitter laidOut={laidOut} fitKey={fitKey} animate={animate} onSettled={onSettled} />
    </ReactFlow>
  );
}

/** Fits the drawing to the screen when a new Layout arrives, then reports it settled once any transition has finished. */
function Fitter({ laidOut, fitKey, animate, onSettled }: { laidOut: LaidOut; fitKey: string; animate: boolean; onSettled: (laidOut: LaidOut) => void }) {
  const { setViewport } = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const first = useRef(true);
  const sized = width > 0 && height > 0;

  useEffect(() => {
    if (!sized) return;
    const { layout } = laidOut;
    const pad = 32;
    const zoom = Math.min(1, (width - 2 * pad) / Math.max(layout.width, 1), (height - 2 * pad) / Math.max(layout.height, 1));
    const duration = animate && !first.current ? DURATION : 0;
    first.current = false;
    void setViewport({ x: (width - layout.width * zoom) / 2, y: (height - layout.height * zoom) / 2, zoom }, { duration });
    // React Flow draws an edge only once both its nodes are measured, so wait for every edge too.
    let frame = 0;
    const whenDrawn = () => {
      if (document.querySelectorAll("path[data-edge-from]").length >= layout.edges.length) onSettled(laidOut);
      else frame = window.requestAnimationFrame(whenDrawn);
    };
    const timer = window.setTimeout(whenDrawn, duration + (animate ? DURATION : 0) + 20);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
    // A new Layout or fitKey refits; a resize alone keeps the user's zoom, so width and height are read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laidOut, fitKey, sized]);
  return null;
}

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setReduced(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const Box = memo(function Box({ data, selected }: NodeProps<Node<BoxData>>) {
  const { node, sublabel, team, container, toggle, onToggle } = data;
  const stop = (e: MouseEvent) => e.stopPropagation();
  const classes = ["ad-box", `ad-${node.kind}`, container ? "ad-container" : "", node.external ? "ad-external" : "", selected ? "ad-selected" : ""];
  return (
    <div className={classes.filter(Boolean).join(" ")} data-node={node.id} data-parent={node.parent ?? ""} aria-selected={selected ? "true" : "false"} title={node.name}>
      <Handle type="target" position={Position.Left} isConnectable={false} className="ad-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="ad-handle" />
      {team && <span className="ad-stripe" data-testid="stripe" style={{ background: team.color }} />}
      <div className="ad-text">
        <div className="ad-name">{node.name}</div>
        <div className="ad-sublabel" data-testid="sublabel">
          {sublabel}
        </div>
      </div>
      {team && (
        <span className="ad-team" data-testid="team">
          {team.code}
        </span>
      )}
      {toggle && (
        <button
          type="button"
          className="ad-toggle nodrag nopan"
          aria-label={`${toggle === "expand" ? "Expand" : "Collapse"} ${node.name}`}
          onClick={(e) => {
            stop(e);
            onToggle(node.id, toggle === "expand");
          }}
          onDoubleClick={stop}
        >
          {toggle === "expand" ? "+" : "−"}
        </button>
      )}
    </div>
  );
});

function Route({ data, markerEnd }: EdgeProps<Edge<RouteData>>) {
  const d = data!.points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" ");
  return <path className={data!.faded ? "ad-edge ad-faded" : "ad-edge"} d={d} markerEnd={markerEnd} fill="none" data-edge-from={data!.from} data-edge-to={data!.to} />;
}

const round = (n: number) => Math.round(n * 100) / 100;
const nodeTypes = { box: Box };
const edgeTypes = { route: Route };
