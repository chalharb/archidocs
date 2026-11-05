"use client";

/**
 * Relationship edges: floating between node borders, drawn as straight, Bezier,
 * step or smooth-step paths (LAYOUT-07), styled per relationship (DIAG-11), and
 * optionally animated from source to target (LAYOUT-25).
 */
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";
import { memo, useContext } from "react";
import type { EdgeType } from "@/domain/resources";
import { borderPoint, type Box, type Side } from "@/editor/geometry";
import type { ArchFlowEdge } from "@/editor/flow";
import { EditorCallbacks } from "./editor-context";

const SIDE: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

function boxOf(node: InternalNode): Box {
  const { x, y } = node.internals.positionAbsolute;
  return {
    x,
    y,
    width: node.measured.width ?? node.width ?? 0,
    height: node.measured.height ?? node.height ?? 0,
  };
}

export function edgePath(
  type: EdgeType,
  p: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
  },
): [path: string, labelX: number, labelY: number] {
  switch (type) {
    case "straight": {
      const [path, x, y] = getStraightPath(p);
      return [path, x, y];
    }
    case "bezier": {
      const [path, x, y] = getBezierPath(p);
      return [path, x, y];
    }
    case "step": {
      const [path, x, y] = getSmoothStepPath({ ...p, borderRadius: 0 });
      return [path, x, y];
    }
    default: {
      const [path, x, y] = getSmoothStepPath({ ...p, borderRadius: 8 });
      return [path, x, y];
    }
  }
}

export const ArchEdge = memo(function ArchEdge({
  id,
  source,
  target,
  data,
  markerEnd,
}: EdgeProps<ArchFlowEdge>) {
  const { staticEdges } = useContext(EditorCallbacks);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode || !data) return null;
  const a = boxOf(sourceNode);
  const b = boxOf(targetNode);
  const s = borderPoint(a, b);
  const t = borderPoint(b, a);
  const [path, labelX, labelY] = edgePath(data.edgeType, {
    sourceX: s.x,
    sourceY: s.y,
    targetX: t.x,
    targetY: t.y,
    sourcePosition: SIDE[s.side],
    targetPosition: SIDE[t.side],
  });
  const { edge } = data;
  const label = edge.label;
  return (
    <g
      data-color={edge.style.color}
      data-testid={`edge-${id}`}
      data-edge-type={data.edgeType}
      data-animated={data.animated}
    >
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className="arch-edge-path"
        data-line={edge.style.line}
        interactionWidth={16}
      />
      {data.animated && !staticEdges && (
        <path className="arch-edge-flow" d={path} data-testid={`edge-flow-${id}`} />
      )}
      {(label || edge.technology) && (
        <EdgeLabelRenderer>
          <div
            className="arch-edge-label nodrag nopan"
            data-color={edge.style.color}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
            {edge.technology && <span className="arch-edge-label-tech">[{edge.technology}]</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});
