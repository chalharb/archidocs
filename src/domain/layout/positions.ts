/**
 * Layout reconciliation (LAYOUT-11, LAYOUT-16/17/18, LAYOUT-24).
 *
 * - Nodes with a layout-file position keep it unchanged (manual overrides win).
 * - Nodes without one get a generated position (level 4 of the precedence).
 * - Overrides for nodes/edges no longer in the diagram are reported as orphans.
 * - Generated placements avoid manual boxes where possible; any remaining
 *   overlap is reported, and manual positions are never moved.
 */
import { diagnostic, type Diagnostic } from "../diagnostics";
import type { ResolvedDiagram, ResolvedEdge, ResolvedNode } from "../diagram-resolve";
import type { CanonicalDiagramLayout } from "../model";
import type { EdgeType, LayoutSettings } from "../resources";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement extends Box {
  source: "manual" | "generated";
}

export interface GeneratorInput {
  /** Nodes that need a generated position, in diagram order. */
  nodes: readonly ResolvedNode[];
  edges: readonly ResolvedEdge[];
  settings: LayoutSettings;
  /** Boxes already occupied by manual positions. */
  occupied: readonly Box[];
}

/** Produces positions for nodes without manual placement. Must be deterministic. */
export type PositionGenerator = (input: GeneratorInput) => Record<string, { x: number; y: number }>;

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Deterministic grid placement used until the ELK.js engine lands (Phase 1).
 * Fills rows for vertical directions and columns for horizontal ones, skipping
 * cells that overlap occupied boxes.
 */
export const gridPositionGenerator: PositionGenerator = ({ nodes, settings, occupied }) => {
  const out: Record<string, { x: number; y: number }> = {};
  const cellW = settings.nodeWidth + settings.nodeSpacing;
  const cellH = settings.nodeHeight + settings.layerSpacing;
  const perLine = Math.max(1, Math.ceil(Math.sqrt(nodes.length + occupied.length)));
  const horizontal = settings.direction === "LEFT" || settings.direction === "RIGHT";
  const taken: Box[] = [...occupied];
  const maxCells = (nodes.length + occupied.length) * 4 + 4;
  let cell = 0;
  for (const node of nodes) {
    let candidate: Box | undefined;
    for (; cell < maxCells; cell++) {
      const line = Math.floor(cell / perLine);
      const pos = cell % perLine;
      const [col, row] = horizontal ? [line, pos] : [pos, line];
      const box = {
        x: col * cellW,
        y: row * cellH,
        width: settings.nodeWidth,
        height: settings.nodeHeight,
      };
      if (!taken.some((t) => overlaps(t, box))) {
        candidate = box;
        cell++;
        break;
      }
    }
    /* v8 ignore next -- unreachable: maxCells always leaves free cells */
    candidate ??= { x: 0, y: 0, width: settings.nodeWidth, height: settings.nodeHeight };
    taken.push(candidate);
    out[node.id] = { x: candidate.x, y: candidate.y };
  }
  return out;
};

export interface ResolvedLayout {
  positions: Record<string, Placement>;
  edgeTypes: Record<string, EdgeType>;
  orphans: { nodes: string[]; edges: string[] };
  /** Pairs [generated node, manual node] that still overlap. */
  collisions: Array<[string, string]>;
  diagnostics: Diagnostic[];
}

export function resolveLayout(input: {
  diagram: ResolvedDiagram;
  layout?: CanonicalDiagramLayout;
  settings: LayoutSettings;
  generator?: PositionGenerator;
}): ResolvedLayout {
  const { diagram, settings } = input;
  const layout = input.layout;
  const generator = input.generator ?? gridPositionGenerator;
  const positions: Record<string, Placement> = {};
  const manual: Array<[string, Box]> = [];
  const pending: ResolvedNode[] = [];

  for (const node of diagram.nodes) {
    const saved = layout?.nodes[node.id];
    if (saved) {
      const box = {
        x: saved.x,
        y: saved.y,
        width: saved.width ?? settings.nodeWidth,
        height: saved.height ?? settings.nodeHeight,
      };
      positions[node.id] = { ...box, source: "manual" };
      manual.push([node.id, box]);
    } else {
      pending.push(node);
    }
  }

  const generated =
    pending.length > 0
      ? generator({
          nodes: pending,
          edges: diagram.edges,
          settings,
          occupied: manual.map(([, b]) => b),
        })
      : {};
  const collisions: Array<[string, string]> = [];
  const diagnostics: Diagnostic[] = [];
  for (const node of pending) {
    const p = generated[node.id] ?? { x: 0, y: 0 };
    const box = { x: p.x, y: p.y, width: settings.nodeWidth, height: settings.nodeHeight };
    positions[node.id] = { ...box, source: "generated" };
    for (const [manualId, manualBox] of manual) {
      if (overlaps(box, manualBox)) {
        collisions.push([node.id, manualId]);
        diagnostics.push(
          diagnostic(
            "warning",
            "LAYOUT_COLLISION",
            `Generated position of '${node.id}' overlaps manually placed '${manualId}' in diagram '${diagram.id}'`,
            { hint: "Move one of the nodes; saved positions are never changed automatically." },
          ),
        );
      }
    }
  }

  const nodeIds = new Set(diagram.nodes.map((n) => n.id));
  const edgeIds = new Set(diagram.edges.map((e) => e.id));
  const edgeTypes: Record<string, EdgeType> = {};
  for (const edge of diagram.edges)
    edgeTypes[edge.id] = layout?.edges[edge.id]?.type ?? settings.edgeType;

  return {
    positions,
    edgeTypes,
    orphans: {
      nodes: Object.keys(layout?.nodes ?? {}).filter((id) => !nodeIds.has(id)),
      edges: Object.keys(layout?.edges ?? {}).filter((id) => !edgeIds.has(id)),
    },
    collisions,
    diagnostics,
  };
}
