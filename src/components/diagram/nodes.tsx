"use client";

/** React Flow node renderers: styled elements and nested boundaries (DIAG-11, LAYOUT-14). */
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { memo, useContext } from "react";
import type { ArchFlowNode } from "@/editor/flow";
import { EditorCallbacks } from "./editor-context";
import { ShapeOutline, contentInsets } from "./shapes";

function HiddenHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} className="arch-handle" isConnectable={false} />
      <Handle
        type="source"
        position={Position.Bottom}
        className="arch-handle"
        isConnectable={false}
      />
    </>
  );
}

export const ElementNode = memo(function ElementNode({
  data,
  width,
  height,
}: NodeProps<ArchFlowNode>) {
  const { node } = data;
  const w = width ?? 200;
  const h = height ?? 100;
  const insets = contentInsets(node.style.shape, w, h);
  return (
    <div
      className="arch-node"
      data-color={node.style.color}
      data-shape={node.style.shape}
      data-entity-id={node.entityId}
      data-testid={`node-${node.id}`}
      style={{ width: w, height: h }}
    >
      <ShapeOutline shape={node.style.shape} width={w} height={h} />
      <div
        className="arch-node-content"
        style={{
          top: insets.top,
          right: insets.right,
          bottom: insets.bottom,
          left: insets.left,
          padding: 0,
        }}
      >
        <div className="arch-node-title">{node.label}</div>
        {node.technology && <div className="arch-node-tech">[{node.technology}]</div>}
        {node.description && <div className="arch-node-desc">{node.description}</div>}
      </div>
      <HiddenHandles />
    </div>
  );
});

export const BoundaryNode = memo(function BoundaryNode({
  id,
  data,
  selected,
}: NodeProps<ArchFlowNode>) {
  const { node } = data;
  const callbacks = useContext(EditorCallbacks);
  return (
    <>
      <NodeResizer
        isVisible={selected && !callbacks.readOnly}
        minWidth={120}
        minHeight={80}
        color="var(--arch-c)"
        onResizeEnd={(_e, box) => callbacks.onResized(id, box)}
      />
      <div
        className="arch-boundary"
        data-color={node.style.color}
        data-entity-id={node.entityId}
        data-testid={`node-${node.id}`}
      >
        <div className="arch-boundary-title">{node.label}</div>
        <div className="arch-boundary-meta">
          {node.entityType}
          {node.technology && <> · [{node.technology}]</>}
        </div>
      </div>
      <HiddenHandles />
    </>
  );
});
