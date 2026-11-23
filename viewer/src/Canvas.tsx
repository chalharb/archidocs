import {
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
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
import { memo, useEffect, useMemo, useRef, type CSSProperties, type MouseEvent } from "react";
import type { CompareMark } from "../../src/core/compare.ts";
import type { ImpactSide, NodeMark, ResolvedView, ViewNode } from "../../src/core/views.ts";
import type { BundleElement } from "../../src/schema/bundle.ts";
import type { TeamStyle } from "../../src/render/teams.ts";
import type { LaidOut } from "./layout.ts";
import { useReducedMotion } from "./motion.ts";
import type { Workspace } from "./workspace.ts";

/** The sub-label under a box's name, as the Variant D prototype writes it: "System · 4 Services", "datastore · Postgres", "External System". */
function describe(node: ViewNode, element: BundleElement | undefined, technology: string | null, holds: string | undefined, deployedAt: string | undefined): string {
  const ext = node.external ? "EXT · " : "";
  if (node.kind === "deployment" && deployedAt) return deployedAt;
  if (node.kind === "system") return node.external ? `${ext}External System` : ["System", holds].filter(Boolean).join(" · ");
  if (node.kind === "service" || node.kind === "deployment") {
    const type = element?.kind === "service" && element.type !== "app" ? element.type : KIND_LABEL[node.kind];
    return ext + [`${node.external ? "External " : ""}${type}`, technology].filter(Boolean).join(" · ");
  }
  return [KIND_LABEL[node.kind], technology].filter(Boolean).join(" · ");
}

/** A Deployment's sub-label, as the prototype writes it: its URL's host and path, else the Deployment Target it runs on. */
function deployedAt(workspace: Workspace, viewId: string, node: ViewNode): string | undefined {
  const target = node.id.slice(node.id.lastIndexOf("@") + 1);
  const environment = viewId.startsWith("deployment/") ? viewId.slice("deployment/".length) : undefined;
  const deployment = workspace.bundle.deployments.find((d) => d.service === node.element && d.target === target && (environment === undefined || d.environment === environment));
  if (deployment?.url) return deployment.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return workspace.targets.get(target)?.name;
}

/** Each kind's glyph, and a Service's type when it isn't a plain app: ⛁ datastore, ≋ broker. */
const GLYPH: Record<string, string> = { person: "◉", system: "▣", service: "▭", component: "◇", deployment: "⬚", target: "☁", datastore: "⛁", broker: "≋" };

/** An impact badge's words: the origin, or the side and distance from it. */
const SIDE_LABEL: Record<ImpactSide, string> = { origin: "⚠ origin", upstream: "▲ upstream", downstream: "▼ downstream" };

/** What a collapsed box holds, as the prototype shows it: "4 Services", "1 Component". */
function countInside(workspace: Workspace, id: string | undefined): string | undefined {
  if (id === undefined) return undefined;
  const kids = workspace.children(id);
  if (kids.length === 0) return undefined;
  const noun = kids[0]!.kind === "service" ? "Service" : kids[0]!.kind === "component" ? "Component" : "Element";
  return `${kids.length} ${noun}${kids.length === 1 ? "" : "s"}`;
}

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
  /** A Service's (or its Deployment's) type, when not a plain app: drawn as its own shape and glyph. */
  type: "datastore" | "broker" | undefined;
  sublabel: string;
  team: TeamStyle | undefined;
  container: boolean;
  /** `+` when collapsed with children to show, `−` when opened by the viewer, else neither. */
  toggle: "expand" | "collapse" | null;
  onToggle: (id: string, open: boolean) => void;
  mark: NodeMark | undefined;
  ring: boolean;
  picked: boolean;
  /** Set while Comparing: how this node changed between the two Revisions. */
  change: CompareMark | undefined;
}

interface RouteData extends Record<string, unknown> {
  points: { x: number; y: number }[];
  faded: boolean;
  /** Set while a Lens is on: whether it lights this edge. */
  lit: boolean | undefined;
  change: CompareMark | undefined;
  from: string;
  to: string;
}

const KIND_LABEL: Record<ViewNode["kind"], string> = { person: "Person", system: "System", service: "Service", component: "Component", target: "Deployment Target", deployment: "Deployment" };

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
      const element = workspace.byId.get(node.element ?? box.id);
      const target = node.kind === "target" ? workspace.targets.get(box.id) : undefined;
      const technology = element && "technology" in element ? element.technology : null;
      const inside = (id: string | undefined) => countInside(workspace, id);
      const canOpen = view.kind !== "c1" && view.kind !== "deployment" && node.collapsed && (node.kind === "system" || node.kind === "service");
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
          type: element?.kind === "service" && element.type !== "app" ? element.type : undefined,
          sublabel: target ? `${KIND_LABEL.target} · ${target.kind}` : describe(node, element, technology, containers.has(box.id) ? undefined : inside(element?.id), node.kind === "deployment" ? deployedAt(workspace, view.id, node) : undefined),
          team: workspace.teams.get(element?.owner ?? target?.owner ?? ""),
          container: containers.has(box.id),
          toggle: canOpen ? "expand" : open.includes(box.id) ? "collapse" : null,
          onToggle,
          mark: marks.get(box.id),
          ring,
          picked: picks.includes(box.id),
          change: node.change,
        },
      };
    });
  }, [view, layout, workspace, selected, open, onToggle, marks, ring, picks]);

  const edgeChanges = useMemo(() => new Map(view.edges.map((e) => [`${e.from}>${e.to}`, e.change])), [view]);
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
          change: edgeChanges.get(`${e.from}>${e.to}`),
          from: e.from,
          to: e.to,
        },
      })),
    [layout, selected, litEdges, edgeChanges],
  );

  return (
    <ReactFlow
      className={["arc-flow", animate ? "arc-animate" : "", zoomedOut ? "arc-zoomed-out" : ""].filter(Boolean).join(" ")}
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
      <Panel position="top-center" className="arc-hintline">
        Shift-click to pick for export · double-click to open a box's own View · / to find
      </Panel>
      <MiniMap position="bottom-left" className="arc-minimap" pannable zoomable ariaLabel="Overview" nodeColor="#a3acb9" nodeStrokeWidth={0} maskColor="rgba(246, 247, 249, 0.6)" />
      <Controls position="bottom-right" showInteractive={false} />
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
    // On a canvas too narrow to spare it (such as beside the Changes list on a small screen), the panel may cover the drawing.
    const room = width - PANEL_WIDTH >= width / 2 ? width - PANEL_WIDTH : width;
    const zoom = Math.max(0.05, Math.min(1, (room - 2 * pad) / Math.max(layout.width, 1), (height - 2 * pad) / Math.max(layout.height, 1)));
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

const Box = memo(function Box({ data, selected }: NodeProps<Node<BoxData>>) {
  const { node, type, sublabel, team, container, toggle, onToggle, mark, ring, picked, change } = data;
  const stop = (e: MouseEvent) => e.stopPropagation();
  const toggleButton = toggle && (
    <button
      type="button"
      className="arc-toggle nodrag nopan"
      aria-label={`${toggle === "expand" ? "Expand" : "Collapse"} ${node.name}`}
      onClick={(e) => {
        stop(e);
        onToggle(node.id, toggle === "expand");
      }}
      onDoubleClick={stop}
    >
      {toggle === "expand" ? "+" : "−"}
    </button>
  );
  const classes = [
    "arc-box",
    `arc-${node.kind}`,
    type ? `arc-t-${type}` : "",
    container ? "arc-container" : "",
    node.external ? "arc-external" : "",
    selected ? "arc-selected" : "",
    mark ? (mark.hit ? "arc-hit" : "arc-dim") : "",
    mark?.hit && ring ? "arc-ringed" : "",
    mark?.hit && mark.side && !(container && !node.collapsed) ? `arc-side-${mark.side}` : "",
    mark?.hit && node.collapsed ? "arc-holds-hit" : "",
    picked ? "arc-picked" : "",
    change ? `arc-${change}` : "",
  ];
  return (
    <div
      className={classes.filter(Boolean).join(" ")}
      style={team ? ({ "--team": team.color } as CSSProperties) : undefined}
      data-node={node.id}
      data-parent={node.parent ?? ""}
      data-hit={mark ? String(mark.hit) : undefined}
      data-distance={mark?.distance}
      data-picked={picked ? "true" : undefined}
      data-change={change}
      aria-selected={selected ? "true" : "false"}
      title={change && change !== "unchanged" ? `${node.name}: ${change === "changed" && node.collapsed ? "changed, or something inside changed" : change}` : mark?.hit && node.collapsed ? `${node.name}: something inside is hit` : node.name}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="arc-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="arc-handle" />
      {/* As the Variant D prototype draws it: [+] glyph Name TEAM on one row, the sub-label under it. */}
      <div className="arc-box-head">
        {toggleButton}
        <span className="arc-kind-glyph" aria-hidden="true">
          {GLYPH[type ?? node.kind]}
        </span>
        <span className="arc-name">{node.name}</span>
        {team && (
          <span className="arc-team" data-testid="team" title={`Owner: ${team.code}`}>
            {team.code}
          </span>
        )}
      </div>
      <div className={container ? "arc-sublabel arc-csub" : "arc-sublabel"} data-testid="sublabel">
        {sublabel}
      </div>
      {mark?.distance !== undefined && !(container && !node.collapsed) && (
        <span className={`arc-badge arc-badge-${mark.side ?? "distance"}`}>
          {mark.side && mark.side !== "origin" && `${SIDE_LABEL[mark.side]} `}
          {mark.side === "origin" && SIDE_LABEL.origin}
          <span className={mark.side === "origin" ? "arc-visually-hidden" : undefined} data-testid="distance" aria-label={`distance ${mark.distance}`}>
            {mark.distance}
          </span>
        </span>
      )}
      {mark?.hit && node.collapsed && <span className="arc-holds" aria-hidden="true" />}
      {change === "added" && (
        <span className="arc-added-mark" data-testid="added" aria-label="added">
          +
        </span>
      )}
      {change === "changed" && <span className="arc-changed-mark" data-testid="changed" aria-label="changed" />}
    </div>
  );
});

function Route({ data, markerEnd }: EdgeProps<Edge<RouteData>>) {
  const d = data!.points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" ");
  const { faded, lit, change } = data!;
  // While a Lens is on it decides which edges stand out; selection fades edges only without one.
  const classes = ["arc-edge", (lit === undefined ? faded : !lit) ? "arc-faded" : "", lit ? "arc-lit" : "", change ? `arc-${change}` : ""];
  const path = (
    <path
      className={classes.filter(Boolean).join(" ")}
      d={d}
      markerEnd={markerEnd}
      fill="none"
      data-edge-from={data!.from}
      data-edge-to={data!.to}
      data-lit={lit === undefined ? undefined : String(lit)}
      data-change={change}
    />
  );
  if (change !== "added" && change !== "changed") return path;
  const mid = midpoint(data!.points);
  return (
    <>
      {path}
      {change === "added" ? (
        <text className="arc-edge-added" x={mid.x} y={mid.y} dy="0.35em" textAnchor="middle" aria-hidden="true">
          +
        </text>
      ) : (
        <circle className="arc-edge-changed" cx={mid.x} cy={mid.y} r={4} aria-hidden="true" />
      )}
    </>
  );
}

/** The point halfway along a polyline. */
function midpoint(points: { x: number; y: number }[]): { x: number; y: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  let left = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]! && lengths[i]! > 0) {
      const t = left / lengths[i]!;
      return { x: points[i]!.x + t * (points[i + 1]!.x - points[i]!.x), y: points[i]!.y + t * (points[i + 1]!.y - points[i]!.y) };
    }
    left -= lengths[i]!;
  }
  return points[0] ?? { x: 0, y: 0 };
}

const round = (n: number) => Math.round(n * 100) / 100;
const nodeTypes = { box: Box };
const edgeTypes = { route: Route };
