import { Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { SEQUENCE, viaLine, type Activation, type SequenceColumn, type SequenceLayout, type SequenceRow } from "../../src/render/sequence.ts";
import type { Workspace } from "./workspace.ts";

/** The zoom never drops below this, so a wide chart pans sideways instead of shrinking out of reading size. */
export const MIN_ZOOM = 0.85;
/** The participant header's height; its lifeline runs down from its bottom. */
const HEADER_BOX = 44;
const MARGIN = 16;
const CAMERA_MS = 300;

export interface SequenceChartProps {
  workspace: Workspace;
  layout: SequenceLayout;
  /** Changes when the chart should fit again: a new View, or brokers shown or hidden. */
  fitKey: string;
  selected: number | null;
  /** While playing, the camera centres each Step and later Steps fade. */
  playing: boolean;
  reducedMotion: boolean;
  onSelect: (n: number) => void;
  /** Called once the chart is fitted and every arrow is drawn. */
  onSettled: (fitKey: string) => void;
}

interface LifelineData extends Record<string, unknown> {
  column: SequenceColumn;
  height: number;
  activations: Activation[];
}

interface MessageData extends Record<string, unknown> {
  row: SequenceRow;
  via: string | undefined;
  selected: boolean;
  later: boolean;
  onSelect: (n: number) => void;
}

export function SequenceChart(props: SequenceChartProps) {
  return (
    <ReactFlowProvider>
      <Chart {...props} />
    </ReactFlowProvider>
  );
}

function Chart({ workspace, layout, fitKey, selected, playing, reducedMotion, onSelect, onSettled }: SequenceChartProps) {
  const nodes = useMemo<Node<LifelineData>[]>(
    () =>
      layout.columns.map((column) => ({
        id: column.id,
        type: "lifeline",
        position: { x: column.x - column.width / 2, y: 0 },
        width: column.width,
        height: layout.height,
        style: { width: column.width, height: layout.height, pointerEvents: "none" },
        draggable: false,
        selectable: false,
        connectable: false,
        data: { column, height: layout.height, activations: layout.activations.filter((a) => a.participant === column.id) },
      })),
    [layout],
  );

  const edges = useMemo<Edge<MessageData>[]>(
    () =>
      layout.rows.map((row) => ({
        id: row.key,
        source: row.from,
        target: row.to,
        type: "message",
        zIndex: 1,
        selectable: false,
        data: {
          row,
          via: viaLine(row, (id) => workspace.name(id)),
          selected: row.n === selected,
          later: playing && selected !== null && row.n > selected,
          onSelect,
        },
      })),
    [layout, workspace, selected, playing, onSelect],
  );

  return (
    <ReactFlow
      className="arc-flow arc-seq"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={MIN_ZOOM}
      maxZoom={2}
      panOnScroll
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <svg className="arc-defs" aria-hidden="true">
        <defs>
          <marker id="arc-head-filled" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arc-head" />
          </marker>
          <marker id="arc-head-open" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10" className="arc-head-open" />
          </marker>
        </defs>
      </svg>
      <Headers workspace={workspace} layout={layout} />
      <Camera layout={layout} fitKey={fitKey} selected={selected} playing={playing} reducedMotion={reducedMotion} onSettled={onSettled} />
    </ReactFlow>
  );
}

/** Fit: the whole chart at the zoom that shows it all, but never below MIN_ZOOM; then follows the selected Step. */
function Camera({ layout, fitKey, selected, playing, reducedMotion, onSettled }: Pick<SequenceChartProps, "layout" | "fitKey" | "selected" | "playing" | "reducedMotion" | "onSettled">) {
  const { setViewport, getViewport } = useReactFlow();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const sized = width > 0 && height > 0;
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    if (!sized) return;
    void setViewport(fitViewport(layout, width, height));
    fitted.current = fitKey;
    let frame = 0;
    const whenDrawn = () => {
      if (document.querySelectorAll("[data-step-edge]").length >= layout.rows.length) onSettled(fitKey);
      else frame = window.requestAnimationFrame(whenDrawn);
    };
    frame = window.requestAnimationFrame(whenDrawn);
    return () => window.cancelAnimationFrame(frame);
    // A new chart refits; a resize alone leaves the camera where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, sized]);

  useEffect(() => {
    if (!sized || selected === null || fitted.current !== fitKey) return;
    const rows = layout.rows.filter((r) => r.n === selected);
    if (rows.length === 0) return;
    const y = (rows[0]!.y + rows.at(-1)!.y) / 2;
    const xs = rows.flatMap((r) => [r.x1, r.x2]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const view = getViewport();
    const motion = cameraMotion(reducedMotion);
    const onScreen = (px: number, py: number) => px * view.zoom + view.x >= 0 && px * view.zoom + view.x <= width && py * view.zoom + view.y >= HEADER_BOX * view.zoom && py * view.zoom + view.y <= height;
    // Playing centres each Step; paused, the chart only scrolls the Step into view.
    if (playing) void setViewport({ x: width / 2 - x * view.zoom, y: height / 2 - y * view.zoom, zoom: view.zoom }, motion);
    else if (!xs.every((px) => onScreen(px, y))) {
      const fitsAcross = Math.max(...xs) - Math.min(...xs) <= width / view.zoom;
      // A Step wider than the screen is shown from its left end.
      void setViewport({ x: fitsAcross ? width / 2 - x * view.zoom : 3 * MARGIN - Math.min(...xs) * view.zoom, y: height / 2 - y * view.zoom, zoom: view.zoom }, motion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, playing, fitKey, sized]);
  return (
    <div className="arc-seq-tools">
      <button type="button" className="arc-action" onClick={() => void setViewport(fitViewport(layout, width, height), cameraMotion(reducedMotion))}>
        Fit whole chart
      </button>
    </div>
  );
}

/**
 * How the camera moves: straight, never along d3's default smooth path,
 * which zooms out mid-flight and would dip below MIN_ZOOM.
 */
const cameraMotion = (reducedMotion: boolean) => ({ duration: reducedMotion ? 0 : CAMERA_MS, interpolate: "linear" as const });

/** The whole chart when it fits at MIN_ZOOM or more, else MIN_ZOOM from the top left; centred across when narrower than the screen. */
function fitViewport(layout: SequenceLayout, width: number, height: number) {
  const zoom = Math.max(MIN_ZOOM, Math.min(1, (width - 2 * MARGIN) / layout.width, (height - MARGIN) / layout.height));
  const x = layout.width * zoom <= width ? (width - layout.width * zoom) / 2 : MARGIN;
  return { x, y: MARGIN / 2, zoom };
}

/** The participant headers, pinned to the top of the chart as it scrolls, and moving with it sideways. */
function Headers({ workspace, layout }: { workspace: Workspace; layout: SequenceLayout }) {
  const [x, y, zoom] = useStore((s) => s.transform);
  const style: CSSProperties = { transform: `translate(${x}px, ${Math.max(y, 0)}px) scale(${zoom})` };
  return (
    <div className="arc-seq-headers" style={style}>
      {layout.columns.map((c) => {
        const element = workspace.byId.get(c.id);
        const team = element ? workspace.teams.get(element.owner) : undefined;
        const external = element !== undefined && "external" in element && element.external;
        return (
          <div
            key={c.id}
            className={external ? "arc-seq-header arc-external" : "arc-seq-header"}
            data-header={c.id}
            title={workspace.name(c.id)}
            style={{ left: c.x - c.width / 2, width: c.width, height: HEADER_BOX }}
          >
            {team && <span className="arc-stripe" style={{ background: team.color }} />}
            <span className="arc-seq-name">{workspace.name(c.id)}</span>
            {team && <span className="arc-team">{team.code}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** A participant's lifeline and activation bars; its header is drawn pinned above the chart. */
const Lifeline = memo(function Lifeline({ data }: NodeProps<Node<LifelineData>>) {
  const { column, height, activations } = data;
  const mid = column.width / 2;
  return (
    <div className="arc-lifeline" data-participant={column.id} style={{ width: column.width, height }}>
      <Handle type="target" position={Position.Top} isConnectable={false} className="arc-handle" />
      <Handle type="source" position={Position.Top} isConnectable={false} className="arc-handle" />
      <svg width={column.width} height={height}>
        <line x1={mid} y1={HEADER_BOX} x2={mid} y2={height - 10} className="arc-lifeline-line" />
        {activations.map((a) => (
          <rect key={`${a.top}:${a.depth}`} className="arc-activation" x={mid - SEQUENCE.bar / 2 + (a.depth * SEQUENCE.bar) / 2} y={a.top - 6} width={SEQUENCE.bar} height={a.bottom - a.top + 12} />
        ))}
      </svg>
    </div>
  );
});

/** One Step (or leg): its arrow in the Step's style, the numbered badge and the label by the sending lifeline. */
function Message({ data }: EdgeProps<Edge<MessageData>>) {
  const { row, via, selected, later, onSelect } = data!;
  const way = row.x2 >= row.x1 ? 1 : -1;
  const badge = row.x1 + way * 14;
  const labelX = row.x1 + way * 28;
  const anchor = way > 0 ? "start" : "end";
  const d = `M${row.x1} ${row.y} L${row.x2} ${row.y}`;
  const under = [via, row.note].filter((s): s is string => s !== undefined);
  const classes = ["arc-step", selected ? "arc-step-selected" : "", later ? "arc-step-later" : ""].filter(Boolean).join(" ");
  return (
    <g className={classes} data-step-edge={row.key} data-step={row.n} data-selected={selected ? "true" : "false"} data-later={later ? "true" : undefined} onClick={() => onSelect(row.n)}>
      <title>{`Step ${row.key}: ${row.label}`}</title>
      <path className="arc-step-hit" d={d} />
      <path className={`arc-step-line arc-step-${row.style}`} d={d} markerEnd={`url(#arc-head-${row.style === "sync" ? "filled" : "open"})`} />
      <circle className="arc-step-badge" cx={badge} cy={row.y} r={9} />
      <text className="arc-step-number" x={badge} y={row.y + 3.5} textAnchor="middle">
        {row.key}
      </text>
      <text className="arc-step-label" x={labelX} y={row.y - 7} textAnchor={anchor}>
        {row.label}
      </text>
      {under.map((s, i) => (
        <text key={i} className="arc-step-sub" x={labelX} y={row.y + 16 + i * SEQUENCE.lineHeight} textAnchor={anchor}>
          {s}
        </text>
      ))}
    </g>
  );
}

const nodeTypes = { lifeline: Lifeline };
const edgeTypes = { message: Message };
