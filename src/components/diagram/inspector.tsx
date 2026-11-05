"use client";

/**
 * Node and edge inspection (DIAG-07): canonical details of the selected element,
 * links to the other diagrams that show it, and per-edge presentation overrides.
 */
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { ResolvedEdge, ResolvedNode } from "@/domain/diagram-resolve";
import { EDGE_TYPES, type EdgePresentation, type EdgeType } from "@/domain/resources";
import type { EntityView } from "@/server/workspace/repository";
import { api } from "./api";
import { EDGE_TYPE_LABEL } from "./settings-panel";

export interface DiagramLink {
  id: string;
  name: string;
}

const control =
  "h-7 rounded-md border bg-background px-2 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring";

function useEntity(workspace: string, entityId: string | undefined) {
  const [state, setState] = useState<{
    id: string;
    view: EntityView | null;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    api.entity(workspace, entityId).then(
      (view) => !cancelled && setState({ id: entityId, view }),
      (e: { message?: string }) =>
        !cancelled && setState({ id: entityId, view: null, error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [workspace, entityId]);
  return state?.id === entityId ? state : null;
}

export function NodeInspector({
  workspace,
  diagramId,
  node,
  diagrams,
}: {
  workspace: string;
  diagramId: string;
  node: ResolvedNode;
  diagrams: readonly DiagramLink[];
}) {
  const entity = useEntity(workspace, node.entityId);
  const names = new Map(diagrams.map((d) => [d.id, d.name]));
  const others = entity?.view?.diagrams.filter((d) => d !== diagramId) ?? [];
  const e = entity?.view?.entity;
  return (
    <section aria-labelledby="inspector-heading" className="flex flex-col gap-2 text-sm">
      <h2 id="inspector-heading" className="font-medium">
        {node.label}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Entity</dt>
        <dd>
          <code>{node.entityId}</code>
        </dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd>{node.entityType}</dd>
        {node.technology && (
          <>
            <dt className="text-muted-foreground">Technology</dt>
            <dd>{node.technology}</dd>
          </>
        )}
        {e?.owner && (
          <>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{e.owner}</dd>
          </>
        )}
        {e && e.tags.length > 0 && (
          <>
            <dt className="text-muted-foreground">Tags</dt>
            <dd>{e.tags.join(", ")}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Style</dt>
        <dd>
          {node.style.shape}, {node.style.color}
        </dd>
      </dl>
      {node.description && <p>{node.description}</p>}
      {entity?.error && <p className="text-destructive">{entity.error}</p>}
      {entity?.view && (
        <>
          <p className="text-muted-foreground">
            {entity.view.outgoing.length} outgoing · {entity.view.incoming.length} incoming
            relationships
          </p>
          <div>
            <h3 className="font-medium">Also shown in</h3>
            {others.length === 0 ? (
              <p className="text-muted-foreground">No other diagrams.</p>
            ) : (
              <ul aria-label="Related diagrams">
                {others.map((d) => (
                  <li key={d}>
                    <Link
                      className="underline underline-offset-2"
                      href={`/workspaces/${encodeURIComponent(workspace)}/diagrams/${encodeURIComponent(d)}?focus=${encodeURIComponent(node.entityId)}`}
                    >
                      {names.get(d) ?? d}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function EdgeInspector({
  edge,
  readOnly,
  presentation,
  effectiveType,
  effectiveAnimated,
  onChange,
}: {
  edge: ResolvedEdge;
  readOnly: boolean;
  presentation: EdgePresentation | undefined;
  effectiveType: EdgeType;
  effectiveAnimated: boolean;
  onChange: (patch: EdgePresentation) => void;
}) {
  const typeId = useId();
  const animId = useId();
  return (
    <section aria-labelledby="edge-inspector-heading" className="flex flex-col gap-2 text-sm">
      <h2 id="edge-inspector-heading" className="font-medium">
        {edge.label ?? edge.relationshipType}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Relationship</dt>
        <dd>
          <code>{edge.relationshipId}</code>
        </dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd>{edge.relationshipType}</dd>
        <dt className="text-muted-foreground">From → to</dt>
        <dd>
          {edge.source} → {edge.target}
        </dd>
        {edge.technology && (
          <>
            <dt className="text-muted-foreground">Technology</dt>
            <dd>{edge.technology}</dd>
          </>
        )}
      </dl>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={typeId}>Edge style</label>
        <select
          id={typeId}
          className={control}
          disabled={readOnly}
          value={presentation?.type ?? ""}
          onChange={(e) =>
            onChange({ type: (e.currentTarget.value || undefined) as EdgeType | undefined })
          }
        >
          <option value="">Diagram default ({EDGE_TYPE_LABEL[effectiveType]})</option>
          {EDGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {EDGE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={animId}>Animation</label>
        <select
          id={animId}
          className={control}
          disabled={readOnly}
          value={presentation?.animated === undefined ? "" : presentation.animated ? "on" : "off"}
          onChange={(e) => {
            const v = e.currentTarget.value;
            onChange({ animated: v === "" ? undefined : v === "on" });
          }}
        >
          <option value="">Diagram default ({effectiveAnimated ? "on" : "off"})</option>
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </div>
    </section>
  );
}
