/**
 * Cross-resource validation (P0-05): references, hierarchies, type rules,
 * diagram endpoints and layout references. Pure and deterministic.
 */
import {
  diagnostic,
  sortDiagnostics,
  type Diagnostic,
  type DiagnosticCode,
  type Severity,
} from "./diagnostics";
import { resolveDiagram } from "./diagram-resolve";
import { effectiveConstraints, findCycles, isSubtypeOf } from "./hierarchy";
import { sourceKey, type ArchitectureModel, type ModelCategory } from "./model";
import type { CustomProperties, JsonValue } from "./resources";

const SECRET_KEY_PATTERN =
  /(passw(or)?d|secret|token|api[-_]?key|private[-_]?key|credential|access[-_]?key)/i;

function secretKeys(value: JsonValue | CustomProperties, prefix: string[] = []): string[][] {
  if (typeof value !== "object" || value === null) return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => secretKeys(v, [...prefix, String(i)]));
  return Object.entries(value).flatMap(([k, v]) => [
    ...(SECRET_KEY_PATTERN.test(k) ? [[...prefix, k]] : []),
    ...secretKeys(v, [...prefix, k]),
  ]);
}

export function validateModel(model: ArchitectureModel): Diagnostic[] {
  const out: Diagnostic[] = [];

  const at = (
    severity: Severity,
    code: DiagnosticCode,
    category: ModelCategory,
    id: string,
    path: Array<string | number>,
    message: string,
    hint?: string,
  ) => {
    const src = model.sources[sourceKey(category, id)]!;
    out.push(
      diagnostic(severity, code, message, {
        file: src.file,
        document: src.document,
        path: [...src.path, ...path],
        hint,
      }),
    );
  };
  const error = (
    code: DiagnosticCode,
    category: ModelCategory,
    id: string,
    path: Array<string | number>,
    message: string,
    hint?: string,
  ) => at("error", code, category, id, path, message, hint);

  if (!model.workspace) {
    out.push(
      diagnostic(
        "warning",
        "WORKSPACE_MISSING",
        "No Workspace resource found; application defaults apply",
        {
          hint: "Add a workspace.yaml with 'kind: Workspace' at the workspace root.",
        },
      ),
    );
  }

  // --- Type definitions ----------------------------------------------------
  for (const t of Object.values(model.entityTypes)) {
    if (t.extends !== undefined && !model.entityTypes[t.extends]) {
      error(
        "REF_MISSING",
        "entityType",
        t.id,
        ["extends"],
        `Entity type '${t.id}' extends unknown type '${t.extends}'`,
      );
    }
  }
  for (const cycle of findCycles(
    Object.keys(model.entityTypes),
    (id) => model.entityTypes[id]?.extends,
  )) {
    error(
      "TYPE_INHERITANCE_CYCLE",
      "entityType",
      cycle[0]!,
      ["extends"],
      `Entity type inheritance cycle: ${[...cycle, cycle[0]].join(" → ")}`,
    );
  }
  for (const t of Object.values(model.relationshipTypes)) {
    if (t.extends !== undefined && !model.relationshipTypes[t.extends]) {
      error(
        "REF_MISSING",
        "relationshipType",
        t.id,
        ["extends"],
        `Relationship type '${t.id}' extends unknown type '${t.extends}'`,
      );
    }
    for (const side of ["sources", "targets"] as const) {
      t[side]?.forEach((typeId, i) => {
        if (!model.entityTypes[typeId]) {
          error(
            "REF_MISSING",
            "relationshipType",
            t.id,
            [side, i],
            `Relationship type '${t.id}' allows unknown entity type '${typeId}'`,
          );
        }
      });
    }
  }
  for (const cycle of findCycles(
    Object.keys(model.relationshipTypes),
    (id) => model.relationshipTypes[id]?.extends,
  )) {
    error(
      "TYPE_INHERITANCE_CYCLE",
      "relationshipType",
      cycle[0]!,
      ["extends"],
      `Relationship type inheritance cycle: ${[...cycle, cycle[0]].join(" → ")}`,
    );
  }

  // --- Entities ------------------------------------------------------------
  for (const e of Object.values(model.entities)) {
    if (!model.entityTypes[e.type]) {
      error(
        "REF_MISSING",
        "entity",
        e.id,
        ["type"],
        `Entity '${e.id}' has unknown type '${e.type}'`,
        "Define it with an EntityType resource.",
      );
    }
    if (e.parent !== undefined && !model.entities[e.parent]) {
      error(
        "REF_MISSING",
        "entity",
        e.id,
        ["parent"],
        `Entity '${e.id}' has unknown parent '${e.parent}'`,
      );
    }
    if (e.project !== undefined && !model.projects[e.project]) {
      error(
        "REF_MISSING",
        "entity",
        e.id,
        ["project"],
        `Entity '${e.id}' references unknown project '${e.project}'`,
      );
    }
    for (const key of secretKeys(e.properties)) {
      at(
        "warning",
        "SECRET_SUSPECTED",
        "entity",
        e.id,
        ["properties", ...key],
        `Property '${key.join(".")}' of entity '${e.id}' looks like a credential`,
        "Do not store credentials or secrets in architecture YAML (SEC-08).",
      );
    }
  }
  for (const cycle of findCycles(Object.keys(model.entities), (id) => model.entities[id]?.parent)) {
    error(
      "HIERARCHY_CYCLE",
      "entity",
      cycle[0]!,
      ["parent"],
      `Parent hierarchy cycle: ${[...cycle, cycle[0]].join(" → ")}`,
      "Parent relationships must form a tree.",
    );
  }

  // --- Relationships -------------------------------------------------------
  for (const r of Object.values(model.relationships)) {
    const relType = model.relationshipTypes[r.type];
    if (!relType) {
      error(
        "REF_MISSING",
        "relationship",
        r.id,
        ["type"],
        `Relationship '${r.id}' has unknown type '${r.type}'`,
        "Define it with a RelationshipType resource.",
      );
    }
    const constraints = relType ? effectiveConstraints(model.relationshipTypes, r.type) : {};
    for (const side of ["source", "target"] as const) {
      const entity = model.entities[r[side]];
      if (!entity) {
        error(
          "REF_MISSING",
          "relationship",
          r.id,
          [side],
          `Relationship '${r.id}' ${side} '${r[side]}' is not a known entity`,
        );
        continue;
      }
      const allowed = side === "source" ? constraints.sources : constraints.targets;
      if (allowed && !allowed.some((a) => isSubtypeOf(model.entityTypes, entity.type, a))) {
        error(
          "RELATIONSHIP_ENDPOINT_TYPE",
          "relationship",
          r.id,
          [side],
          `Relationship '${r.id}' of type '${r.type}' cannot have a ${side} of type '${entity.type}' ('${entity.id}')`,
          `Allowed ${side} types (or their subtypes): ${allowed.join(", ")}.`,
        );
      }
    }
    for (const key of secretKeys(r.properties)) {
      at(
        "warning",
        "SECRET_SUSPECTED",
        "relationship",
        r.id,
        ["properties", ...key],
        `Property '${key.join(".")}' of relationship '${r.id}' looks like a credential`,
        "Do not store credentials or secrets in architecture YAML (SEC-08).",
      );
    }
  }

  // --- Projects --------------------------------------------------------------
  for (const p of Object.values(model.projects)) {
    for (const key of secretKeys(p.properties)) {
      at(
        "warning",
        "SECRET_SUSPECTED",
        "project",
        p.id,
        ["properties", ...key],
        `Property '${key.join(".")}' of project '${p.id}' looks like a credential`,
        "Do not store credentials or secrets in architecture YAML (SEC-08).",
      );
    }
  }

  // --- Diagrams ------------------------------------------------------------
  for (const id of Object.keys(model.diagrams)) out.push(...resolveDiagram(model, id).diagnostics);

  // --- Layouts (LAYOUT-13, LAYOUT-18) ----------------------------------------
  for (const layout of Object.values(model.layouts)) {
    const diagram = model.diagrams[layout.diagram];
    if (!diagram) {
      at(
        "warning",
        "LAYOUT_ORPHAN_DIAGRAM",
        "layout",
        layout.diagram,
        ["diagram"],
        `Layout references unknown diagram '${layout.diagram}'`,
        "Delete the layout file or restore the diagram.",
      );
      continue;
    }
    const nodeIds = new Set(diagram.nodes.map((n) => n.id));
    for (const nodeId of Object.keys(layout.nodes)) {
      if (!nodeIds.has(nodeId)) {
        at(
          "warning",
          "LAYOUT_ORPHAN_NODE",
          "layout",
          layout.diagram,
          ["nodes", nodeId],
          `Layout position for '${nodeId}' does not match any node in diagram '${layout.diagram}'`,
          "The node was removed or renamed. Remove the override or rename it to match.",
        );
      }
    }
    const edgeIds = new Set(diagram.edges.map((e) => e.id));
    for (const edgeId of Object.keys(layout.edges)) {
      if (!edgeIds.has(edgeId)) {
        at(
          "warning",
          "LAYOUT_ORPHAN_EDGE",
          "layout",
          layout.diagram,
          ["edges", edgeId],
          `Layout style for edge '${edgeId}' does not match any edge in diagram '${layout.diagram}'`,
          "The edge was removed or renamed. Remove the override or rename it to match.",
        );
      }
    }
  }

  return sortDiagnostics(out);
}
