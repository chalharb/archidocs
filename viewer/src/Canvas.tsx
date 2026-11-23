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
import type { NodeMark, ResolvedView, ViewNode } from "../../src/core/views.ts";
import type { TeamStyle } from "../../src/render/teams.ts";
import type { LaidOut } from "./layout.ts";
import type { Workspace } from "./workspace.ts";

/** Animated transitions run up to this many nodes, and never with `prefers-reduced-motion`. */
export const ANIMATE_MAX_NODES = 100;
const DURATION = 300;
/** The Element panel's width; it overlays the canvas's right edge, so the drawing is fitted to the space beside it. */
export const PANEL_WIDTH = 340;
/** Below this zoom, sub-labels and Team codes hide. */
export const DETAIL_ZOOM = 0.45;

export interface CanvasProps {
  workspace: Workspace;
  laidOut: LaidOut;
  selected: string | null;
  open: readonly string[];
  /** Changes when the screen should fit the drawing again, such as a new View or direction. */
  fitKey: string;
  /** The same View resolved with the Lens, when one is on: its node marks and lit edges are drawn over this Layout. */
  lensed?: ResolvedView;
  /** Picked node ids. */
  picks: readonly string[];
  /** Ringed rather than badged: a Team Lens. */
  ring: boolean;
  onSelect: (id: string | null) => void;
  /** Shift-click: picks or unpicks a node. */
  onPick: (id: string) => void;
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
  mark: NodeMark | undefined;
  ring: boolean;
  picked: boolean;
}

interface RouteData extends Record<string, unknown> {
  points: { x: number; y: number }[];
  faded: boolean;
  /** Set while a Lens is on: whether it lights this edge. */
  lit: boolean | undefined;
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

function Flow({ workspace, laidOut, selected, open, fitKey, lensed, picks, ring, onSelect, onPick, onToggle, onOpenView, onSettled }: CanvasProps) {
  const { view, layout } = laidOut;
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion && view.nodes.length <= ANIMATE_MAX_NODES;
  const zoomedOut = useStore((s) => s.transform[2] < DETAIL_ZOOM);

  const marks = useMemo(() => new Map(lensed?.nodes.map((n) => [n.id, n.mark]) ?? []), [lensed]);
  const litEdges = useMemo(() => (lensed ? new Map(lensed.edges.map((e) => [`${e.from}>${e.to}`, e.lit === true])) : undefined), [lensed]);

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
          mark: marks.get(box.id),
          ring,
          picked: picks.includes(box.id),
        },
      };
    });
  }, [view, layout, workspace, selected, open, onToggle, marks, ring, picks]);

  const edges = useMemo<Edge<RouteData>[]>(
    () =>
      layout.edges.map((e) => ({
        id: `${e.from}>${e.to}`,
        source: e.from,
        target: e.to,
        type: "route",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        selectable: false,
        data: {
          points: e.points,
          faded: selected !== null && e.from !== selected && e.to !== selected,
          lit: litEdges?.get(`${e.from}>${e.to}`),
          from: e.from,
          to: e.to,
        },
      })),
    [layout, selected, litEdges],
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
      onNodeClick={(event, node) => (event.shiftKey ? onPick(node.id) : onSelect(node.id))}
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
    // Leave room for the Element panel, so opening it never hides or moves a node.
    const room = width - PANEL_WIDTH;
    const zoom = Math.min(1, (room - 2 * pad) / Math.max(layout.width, 1), (height - 2 * pad) / Math.max(layout.height, 1));
    const duration = animate && !first.current ? DURATION : 0;
    first.current = false;
    void setViewport({ x: (room - layout.width * zoom) / 2, y: (height - layout.height * zoom) / 2, zoom }, { duration });
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
    // A new Layout or fitKey refits; a resize alone (such as the Element panel opening) keeps the drawing where it is,
    // so width and height are read, not watched.
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
  const { node, sublabel, team, container, toggle, onToggle, mark, ring, picked } = data;
  const stop = (e: MouseEvent) => e.stopPropagation();
  const classes = [
    "ad-box",
    `ad-${node.kind}`,
    container ? "ad-container" : "",
    node.external ? "ad-external" : "",
    selected ? "ad-selected" : "",
    mark ? (mark.hit ? "ad-hit" : "ad-dim") : "",
    mark?.hit && ring ? "ad-ringed" : "",
    mark?.hit && node.collapsed ? "ad-holds-hit" : "",
    picked ? "ad-picked" : "",
  ];
  return (
    <div
      className={classes.filter(Boolean).join(" ")}
      data-node={node.id}
      data-parent={node.parent ?? ""}
      data-hit={mark ? String(mark.hit) : undefined}
      data-distance={mark?.distance}
      data-picked={picked ? "true" : undefined}
      aria-selected={selected ? "true" : "false"}
      title={mark?.hit && node.collapsed ? `${node.name}: something inside is hit` : node.name}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="ad-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="ad-handle" />
      {team && <span className="ad-stripe" data-testid="stripe" style={{ background: team.color }} />}
      <div className="ad-text">
        <div className="ad-name">{node.name}</div>
        <div className="ad-sublabel" data-testid="sublabel">
          {sublabel}
        </div>
      </div>
      {mark?.distance !== undefined && (
        <span className="ad-distance" data-testid="distance" aria-label={`distance ${mark.distance}`}>
          {mark.distance}
        </span>
      )}
      {mark?.hit && node.collapsed && <span className="ad-holds" aria-hidden="true" />}
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
  const { faded, lit } = data!;
  // While a Lens is on it decides which edges stand out; selection fades edges only without one.
  const classes = ["ad-edge", (lit === undefined ? faded : !lit) ? "ad-faded" : "", lit ? "ad-lit" : ""];
  return (
    <path
      className={classes.filter(Boolean).join(" ")}
      d={d}
      markerEnd={markerEnd}
      fill="none"
      data-edge-from={data!.from}
      data-edge-to={data!.to}
      data-lit={lit === undefined ? undefined : String(lit)}
    />
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
const nodeTypes = { box: Box };
const edgeTypes = { route: Route };
