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
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { CompareMark } from "../../src/core/compare.ts";
import type { ImpactSide, NodeMark, ResolvedView, ViewNode } from "../../src/core/views.ts";
import type { BundleElement } from "../../src/schema/bundle.ts";
import type { TeamStyle } from "../../src/render/teams.ts";
import type { LaidOut } from "./layout.ts";
import { Icon, type IconName } from "./Icon.tsx";
import { useReducedMotion } from "./motion.ts";
import type { Workspace } from "./workspace.ts";
import { CtrlWheelZoom } from "./wheel.tsx";

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

/** Each kind's pictogram, and a Service's type when it isn't a plain app. */
const KIND_ICON: Record<string, IconName> = { person: "person", system: "system", service: "service", component: "component", deployment: "deployment", target: "target", datastore: "datastore", broker: "broker" };

/** Above this many boxes the overview map earns its corner; below it the whole View already fits on screen. */
const MINIMAP_MIN_NODES = 40;

/** An impact badge's sign and words: the origin, or the side and distance from it. */
const SIDE_LABEL: Record<ImpactSide, string> = { origin: "origin", upstream: "upstream", downstream: "downstream" };
const SIDE_ICON: Record<ImpactSide, IconName> = { origin: "origin", upstream: "up", downstream: "down" };

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
/** A fit never shrinks the drawing below this; a bigger View opens at its start, readable, and pans for the rest. */
export const MIN_FIT_ZOOM = 0.6;
/** The space kept between the drawing and the canvas edges, or the Element panel. */
const FIT_PAD = 32;
/** How long a selection waits before panning, so a double-click's second click still lands on the same box. */
const DOUBLE_CLICK_WAIT = 400;

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
        // A rebuilt node without `measured` loses its handle bounds, and React Flow hides its edges until it measures it again.
        measured: { width: box.width, height: box.height },
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
      // Figma's pattern, for mouse and trackpad alike: scroll pans 1:1 (Shift turns a mouse wheel sideways),
      // pinch or ⌘/Ctrl with the wheel zooms, and a left- or middle-button drag on the background pans.
      panOnScroll
      panOnScrollSpeed={1}
      panOnDrag={[0, 1]}
      // A selected box stays at its own depth, so a selected container never covers the boxes inside it.
      elevateNodesOnSelect={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(event, node) => (event.shiftKey ? onPick(node.id) : onSelect(node.id))}
      onNodeDoubleClick={(_, node) => onOpenView(node.id)}
      onPaneClick={() => onSelect(null)}
    >
      <Panel position="bottom-left" className="arc-key-panel">
        <Key lens={lensed !== undefined} />
      </Panel>
      {view.nodes.length > MINIMAP_MIN_NODES && <MiniMap position="top-right" className="arc-minimap" pannable zoomable ariaLabel="Overview" nodeStrokeWidth={0} />}
      <Controls position="bottom-right" showInteractive={false} />
      <Fitter laidOut={laidOut} fitKey={fitKey} selected={selected} animate={animate} onSettled={onSettled} />
      <KeepBesidePanel selected={selected} animate={animate} />
      <CtrlWheelZoom />
    </ReactFlow>
  );
}

/** The map key: what every mark on the canvas means, and the canvas's gestures. It folds away and stays folded. */
function Key({ lens }: { lens: boolean }) {
  const [open, setOpen] = useState(() => readKeyOpen());
  return (
    <details
      className="arc-key"
      open={open}
      onToggle={(e) => {
        // The element also fires toggle when it first renders open; only a visitor's own toggle is remembered.
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next === open) return;
        setOpen(next);
        writeKeyOpen(next);
      }}
    >
      <summary>Key</summary>
      <ul>
        <li>
          <span className="arc-key-swatch arc-key-team" aria-hidden="true">
            <span>COR</span>
          </span>
          Left edge and code: owning Team
        </li>
        <li>
          <span className="arc-key-swatch arc-key-external" aria-hidden="true" />
          Dashed: External
        </li>
        <li>
          <span className="arc-key-swatch arc-key-broker" aria-hidden="true" />
          Striped: broker
        </li>
        {lens && (
          <>
            <li>
              <span className="arc-key-swatch arc-key-origin" aria-hidden="true" />
              Lens origin
            </li>
            <li>
              <span className="arc-key-swatch arc-key-up" aria-hidden="true" />
              Upstream
              <span className="arc-key-swatch arc-key-down" aria-hidden="true" />
              Downstream
            </li>
            <li>
              <span className="arc-key-swatch arc-key-holds" aria-hidden="true">
                <span />
              </span>
              Something inside is hit
            </li>
          </>
        )}
      </ul>
      <p className="arc-key-gestures">Shift-click picks for export · double-click opens a box's own View · / finds</p>
    </details>
  );
}

/** Open by default only where the canvas has room for it beside the drawing; afterwards it stays as the visitor left it. */
function readKeyOpen(): boolean {
  const roomy = window.innerWidth >= 1200 && window.innerHeight >= 760;
  try {
    const stored = window.localStorage.getItem("archidocs.key");
    return stored === null ? roomy : stored === "open";
  } catch {
    return roomy;
  }
}

function writeKeyOpen(open: boolean) {
  try {
    window.localStorage.setItem("archidocs.key", open ? "open" : "closed");
  } catch {
    // The key simply opens again next time.
  }
}

/** The canvas width the Element panel leaves free, or the whole width on a canvas too narrow to spare it. */
function besidePanel(width: number): number {
  return width - PANEL_WIDTH >= width / 2 ? width - PANEL_WIDTH : width;
}

/**
 * Fits the drawing to the screen when a new Layout arrives, then reports it settled once any transition has finished.
 * The fit uses the whole canvas unless something is selected (the Element panel then takes the right edge), never
 * zooms past 1:1, and never below MIN_FIT_ZOOM: a View too big for that opens at its start and pans for the rest.
 */
function Fitter({ laidOut, fitKey, selected, animate, onSettled }: { laidOut: LaidOut; fitKey: string; selected: string | null; animate: boolean; onSettled: (laidOut: LaidOut) => void }) {
  const { setViewport } = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const first = useRef(true);
  const sized = width > 0 && height > 0;

  useEffect(() => {
    if (!sized) return;
    const { layout } = laidOut;
    const room = selected === null ? width : besidePanel(width);
    const fit = Math.min(1, (room - 2 * FIT_PAD) / Math.max(layout.width, 1), (height - 2 * FIT_PAD) / Math.max(layout.height, 1));
    const zoom = Math.max(MIN_FIT_ZOOM, fit);
    // Centred when the whole drawing fits; otherwise from its top-left corner, where a View starts reading.
    const x = layout.width * zoom <= room - 2 * FIT_PAD ? (room - layout.width * zoom) / 2 : FIT_PAD;
    const y = layout.height * zoom <= height - 2 * FIT_PAD ? (height - layout.height * zoom) / 2 : FIT_PAD;
    const duration = animate && !first.current ? DURATION : 0;
    first.current = false;
    void setViewport({ x, y, zoom }, { duration });
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
    // A new Layout or fitKey refits; a resize or a new selection alone keeps the drawing where it is,
    // so width, height and selected are read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laidOut, fitKey, sized]);
  return null;
}

/** When a selection opens the Element panel over the selected box, pans just enough to bring the box out beside it. */
function KeepBesidePanel({ selected, animate }: { selected: string | null; animate: boolean }) {
  const { getInternalNode, getViewport, setViewport } = useReactFlow();
  const width = useStore((s) => s.width);
  useEffect(() => {
    if (selected === null || width === 0) return;
    // Wait out a double-click first: panning between its two clicks would move the box from under the second one.
    const timer = window.setTimeout(() => {
      const node = getInternalNode(selected);
      if (!node) return;
      const { x, y, zoom } = getViewport();
      const left = node.internals.positionAbsolute.x * zoom + x;
      const right = left + (node.measured.width ?? node.width ?? 0) * zoom;
      const edge = besidePanel(width) - FIT_PAD;
      if (right <= edge) return;
      // Move left by the overlap, but never push the box's own left edge off the canvas.
      const shift = Math.min(right - edge, Math.max(0, left - FIT_PAD));
      if (shift > 0) void setViewport({ x: x - shift, y, zoom }, { duration: animate ? DURATION : 0 });
    }, DOUBLE_CLICK_WAIT);
    return () => window.clearTimeout(timer);
    // Only a new selection pans; the canvas size is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
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
      <Icon name={toggle === "expand" ? "plus" : "minus"} />
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
        <Icon name={KIND_ICON[type ?? node.kind]!} className="arc-kind-glyph" />
        <span className="arc-name">{node.name}</span>
        {/* An open box's sub-label sits in its head row, after the name, and gives way to it when space runs out. */}
        {container && (
          <span className="arc-sublabel arc-csub" data-testid="sublabel" title={sublabel}>
            {sublabel}
          </span>
        )}
        {team && (
          <span className="arc-team" data-testid="team" title={`Owner: ${team.code}`}>
            {team.code}
          </span>
        )}
      </div>
      {!container && (
        <div className="arc-sublabel" data-testid="sublabel">
          {sublabel}
        </div>
      )}
      {mark?.distance !== undefined && !(container && !node.collapsed) && (
        <span className={`arc-badge arc-badge-${mark.side ?? "distance"}`}>
          {mark.side && <Icon name={SIDE_ICON[mark.side]} className="arc-badge-icon" />}
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
