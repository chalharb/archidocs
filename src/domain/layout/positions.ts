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
  /** Node ID of each `occupied` box, in the same order. */
  occupiedIds?: readonly string[];
}

/** A generated position; generators may also size nodes (e.g. boundaries, LAYOUT-14). */
export interface GeneratedPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** Produces positions for nodes without manual placement. Must be deterministic. */
export type PositionGenerator = (input: GeneratorInput) => Record<string, GeneratedPosition>;

/** Asynchronous variant, used by the ELK.js engine (LAYOUT-04). */
export type AsyncPositionGenerator = (
  input: GeneratorInput,
) => Promise<Record<string, GeneratedPosition>>;

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
  /** Effective animation per edge: edge override, else `animateEdges` (LAYOUT-25). */
  edgeAnimated: Record<string, boolean>;
  orphans: { nodes: string[]; edges: string[] };
  /** Pairs [generated node, manual node] that still overlap. */
  collisions: Array<[string, string]>;
  diagnostics: Diagnostic[];
}

interface LayoutInput {
  diagram: ResolvedDiagram;
  layout?: CanonicalDiagramLayout;
  settings: LayoutSettings;
}

interface LayoutPlan {
  positions: Record<string, Placement>;
  manual: Array<[string, Box]>;
  pending: ResolvedNode[];
  generatorInput: GeneratorInput;
}

function planLayout({ diagram, layout, settings }: LayoutInput): LayoutPlan {
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
  return {
    positions,
    manual,
    pending,
    generatorInput: {
      nodes: pending,
      edges: diagram.edges,
      settings,
      occupied: manual.map(([, b]) => b),
      occupiedIds: manual.map(([id]) => id),
    },
  };
}

/** Each node's chain of enclosing boundaries (LAYOUT-14), nearest first. Cycle-safe. */
function boundaryAncestors(diagram: ResolvedDiagram): Map<string, Set<string>> {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const out = new Map<string, Set<string>>();
  for (const node of diagram.nodes) {
    const chain = new Set<string>();
    let current = node.boundary;
    while (current !== undefined && current !== node.id && !chain.has(current)) {
      chain.add(current);
      current = byId.get(current)?.boundary;
    }
    out.set(node.id, chain);
  }
  return out;
}

function finishLayout(
  { diagram, layout, settings }: LayoutInput,
  plan: LayoutPlan,
  generated: Record<string, GeneratedPosition>,
): ResolvedLayout {
  const { positions, manual, pending } = plan;
  const collisions: Array<[string, string]> = [];
  const diagnostics: Diagnostic[] = [];
  const ancestors = manual.length > 0 ? boundaryAncestors(diagram) : new Map<string, Set<string>>();
  const related = (a: string, b: string) =>
    ancestors.get(a)?.has(b) === true || ancestors.get(b)?.has(a) === true;
  for (const node of pending) {
    const p = generated[node.id] ?? { x: 0, y: 0 };
    const box = {
      x: p.x,
      y: p.y,
      width: p.width ?? settings.nodeWidth,
      height: p.height ?? settings.nodeHeight,
    };
    positions[node.id] = { ...box, source: "generated" };
    for (const [manualId, manualBox] of manual) {
      // A boundary is meant to overlap the nodes it contains.
      if (related(manualId, node.id)) continue;
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
  const edgeAnimated: Record<string, boolean> = {};
  for (const edge of diagram.edges) {
    edgeTypes[edge.id] = layout?.edges[edge.id]?.type ?? settings.edgeType;
    edgeAnimated[edge.id] = layout?.edges[edge.id]?.animated ?? settings.animateEdges;
  }

  return {
    positions,
    edgeTypes,
    edgeAnimated,
    orphans: {
      nodes: Object.keys(layout?.nodes ?? {}).filter((id) => !nodeIds.has(id)),
      edges: Object.keys(layout?.edges ?? {}).filter((id) => !edgeIds.has(id)),
    },
    collisions,
    diagnostics,
  };
}

export function resolveLayout(
  input: LayoutInput & { generator?: PositionGenerator },
): ResolvedLayout {
  const plan = planLayout(input);
  const generator = input.generator ?? gridPositionGenerator;
  return finishLayout(input, plan, plan.pending.length > 0 ? generator(plan.generatorInput) : {});
}

/** Like `resolveLayout`, with an asynchronous generator such as ELK.js (LAYOUT-04). */
export async function resolveLayoutAsync(
  input: LayoutInput & { generator: AsyncPositionGenerator | PositionGenerator },
): Promise<ResolvedLayout> {
  const plan = planLayout(input);
  const generated = plan.pending.length > 0 ? await input.generator(plan.generatorInput) : {};
  return finishLayout(input, plan, generated);
}
