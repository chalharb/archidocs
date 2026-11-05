/**
 * Diagram resolution (P0-07): turn a diagram definition into normalized,
 * renderable nodes and edges.
 *
 * - Every rendered node keeps a reference to its canonical entity (DIAG-08).
 * - One entity may appear as several view instances (DIAG-09); edges then name
 *   the instances they connect explicitly.
 * - Invalid nodes/edges are dropped from the output and reported as diagnostics.
 */
import { diagnostic, type Diagnostic, type DiagnosticCode } from "./diagnostics";
import { sourceKey, type ArchitectureModel } from "./model";
import type { DiagramType } from "./resources";

export interface ResolvedNode {
  /** View-instance ID (unique within the diagram). */
  id: string;
  /** Canonical entity reference (DIAG-08). */
  entityId: string;
  label: string;
  entityType: string;
  technology?: string;
  description?: string;
  parentEntityId?: string;
}

export interface ResolvedEdge {
  id: string;
  /** Canonical relationship reference (DIAG-08). */
  relationshipId: string;
  relationshipType: string;
  /** Source view-instance ID. */
  source: string;
  /** Target view-instance ID. */
  target: string;
  label?: string;
  technology?: string;
}

export interface ResolvedDiagram {
  id: string;
  name: string;
  diagramType: DiagramType;
  description?: string;
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
}

export function resolveDiagram(
  model: ArchitectureModel,
  diagramId: string,
): { diagram: ResolvedDiagram | null; diagnostics: Diagnostic[] } {
  const def = model.diagrams[diagramId];
  if (!def) return { diagram: null, diagnostics: [] };

  const src = model.sources[sourceKey("diagram", diagramId)]!;
  const diagnostics: Diagnostic[] = [];
  const report = (
    code: DiagnosticCode,
    message: string,
    path: Array<string | number>,
    hint?: string,
  ) =>
    diagnostics.push(
      diagnostic("error", code, message, {
        file: src.file,
        document: src.document,
        path: [...src.path, ...path],
        hint,
      }),
    );

  const nodes: ResolvedNode[] = [];
  const nodeEntity = new Map<string, string>();
  const instancesOf = new Map<string, string[]>();

  def.nodes.forEach((node, i) => {
    if (nodeEntity.has(node.id)) {
      report(
        "DIAGRAM_DUPLICATE_NODE",
        `Duplicate node ID '${node.id}' in diagram '${diagramId}'`,
        ["nodes", i, "id"],
        "Give each view instance of the same entity a distinct 'id'.",
      );
      return;
    }
    const entity = model.entities[node.entity];
    if (!entity) {
      report(
        "REF_MISSING",
        `Diagram node '${node.id}' references unknown entity '${node.entity}'`,
        ["nodes", i, "entity"],
      );
      return;
    }
    nodeEntity.set(node.id, entity.id);
    instancesOf.set(entity.id, [...(instancesOf.get(entity.id) ?? []), node.id]);
    nodes.push({
      id: node.id,
      entityId: entity.id,
      label: node.label ?? entity.name,
      entityType: entity.type,
      ...(entity.technology !== undefined ? { technology: entity.technology } : {}),
      ...(entity.description !== undefined ? { description: entity.description } : {}),
      ...(entity.parent !== undefined ? { parentEntityId: entity.parent } : {}),
    });
  });

  const edges: ResolvedEdge[] = [];
  const edgeIds = new Set<string>();

  def.edges.forEach((edge, i) => {
    if (edgeIds.has(edge.id)) {
      report(
        "DIAGRAM_DUPLICATE_EDGE",
        `Duplicate edge ID '${edge.id}' in diagram '${diagramId}'`,
        ["edges", i, "id"],
        "Give each edge that shows the same relationship a distinct 'id'.",
      );
      return;
    }
    edgeIds.add(edge.id);
    const rel = model.relationships[edge.relationship];
    if (!rel) {
      report(
        "REF_MISSING",
        `Diagram edge '${edge.id}' references unknown relationship '${edge.relationship}'`,
        ["edges", i, "relationship"],
      );
      return;
    }

    const endpoint = (side: "source" | "target"): string | undefined => {
      const wantedEntity = rel[side];
      const explicit = edge[side];
      if (explicit !== undefined) {
        const actual = nodeEntity.get(explicit);
        if (actual === undefined) {
          report(
            "REF_MISSING",
            `Edge '${edge.id}' ${side} '${explicit}' is not a node in diagram '${diagramId}'`,
            ["edges", i, side],
          );
          return undefined;
        }
        if (actual !== wantedEntity) {
          report(
            "DIAGRAM_ENDPOINT_MISMATCH",
            `Edge '${edge.id}' ${side} node '${explicit}' shows entity '${actual}', but relationship '${rel.id}' ${side} is '${wantedEntity}'`,
            ["edges", i, side],
            `Use a node that shows '${wantedEntity}'.`,
          );
          return undefined;
        }
        return explicit;
      }
      const candidates = instancesOf.get(wantedEntity) ?? [];
      if (candidates.length === 0) {
        report(
          "DIAGRAM_ENDPOINT_MISMATCH",
          `Edge '${edge.id}': ${side} entity '${wantedEntity}' of relationship '${rel.id}' is not shown in diagram '${diagramId}'`,
          ["edges", i, "relationship"],
          `Add a node for '${wantedEntity}' or remove this edge.`,
        );
        return undefined;
      }
      if (candidates.length > 1) {
        report(
          "DIAGRAM_ENDPOINT_AMBIGUOUS",
          `Edge '${edge.id}': entity '${wantedEntity}' appears as several nodes (${candidates.join(", ")})`,
          ["edges", i],
          `Set '${side}' to one of: ${candidates.join(", ")}.`,
        );
        return undefined;
      }
      return candidates[0];
    };

    const source = endpoint("source");
    const target = endpoint("target");
    if (source === undefined || target === undefined) return;
    const label = edge.label ?? rel.description;
    edges.push({
      id: edge.id,
      relationshipId: rel.id,
      relationshipType: rel.type,
      source,
      target,
      ...(label !== undefined ? { label } : {}),
      ...(rel.technology !== undefined ? { technology: rel.technology } : {}),
    });
  });

  return {
    diagram: {
      id: def.id,
      name: def.name,
      diagramType: def.diagramType,
      ...(def.description !== undefined ? { description: def.description } : {}),
      nodes,
      edges,
    },
    diagnostics,
  };
}
