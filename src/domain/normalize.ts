/**
 * Normalization: parsed resources -> canonical model (P0-03, MODEL-03).
 *
 * Determinism (SCHEMA-09): inputs are sorted by (file, document) before folding,
 * and every record is rebuilt with sorted keys, so the result never depends on
 * the order in which files were discovered. When an ID is defined twice, the
 * definition with the lowest (file, document, path) wins and the others produce
 * diagnostics that point back to it.
 */
import { diagnostic, type Diagnostic } from "./diagnostics";
import { analyzeMarkdown } from "./markdown";
import { compareSources, sortRecord } from "./order";
import {
  emptyModel,
  sourceKey,
  type ArchitectureModel,
  type CanonicalDiagram,
  type CanonicalEntity,
  type CanonicalRelationship,
  type ModelCategory,
} from "./model";
import type {
  DiagramResource,
  EntityFields,
  ParsedResource,
  RelationshipFields,
  SourceRef,
} from "./resources";

/** Copy only defined optional fields, so absent values never appear as `undefined` keys. */
function defined<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = v;
  return out as T;
}

export function toCanonicalEntity(fields: EntityFields): CanonicalEntity {
  return defined({
    id: fields.id,
    name: fields.name,
    type: fields.type,
    description: fields.description,
    parent: fields.parent,
    project: fields.project,
    technology: fields.technology,
    owner: fields.owner,
    tags: [...(fields.tags ?? [])],
    properties: { ...(fields.properties ?? {}) },
    style: fields.style ? { ...fields.style } : undefined,
  });
}

export function toCanonicalRelationship(fields: RelationshipFields): CanonicalRelationship {
  return defined({
    id: fields.id,
    type: fields.type,
    source: fields.source,
    target: fields.target,
    description: fields.description,
    technology: fields.technology,
    tags: [...(fields.tags ?? [])],
    properties: { ...(fields.properties ?? {}) },
    style: fields.style ? { ...fields.style } : undefined,
  });
}

export function toCanonicalDiagram(resource: DiagramResource): CanonicalDiagram {
  return defined({
    id: resource.id,
    name: resource.name,
    diagramType: resource.diagramType,
    description: resource.description,
    layout: { ...(resource.layout ?? {}) },
    nodes: resource.nodes.map((n) =>
      defined({ id: n.id ?? n.entity, entity: n.entity, label: n.label }),
    ),
    edges: (resource.edges ?? []).map((e) =>
      defined({
        id: e.id ?? e.relationship,
        relationship: e.relationship,
        source: e.source,
        target: e.target,
        label: e.label,
      }),
    ),
  });
}

const CATEGORY_LABEL: Record<ModelCategory, string> = {
  workspace: "Workspace",
  project: "project",
  entityType: "entity type",
  relationshipType: "relationship type",
  entity: "entity",
  relationship: "relationship",
  diagram: "diagram",
  layout: "layout for diagram",
  collection: "collection",
  document: "document",
  decision: "decision",
};

export function normalize(parsed: readonly ParsedResource[]): {
  model: ArchitectureModel;
  diagnostics: Diagnostic[];
} {
  const model = emptyModel();
  const diagnostics: Diagnostic[] = [];

  /** Register an item; returns false (and reports) if the ID is already taken. */
  const claim = (category: ModelCategory, id: string, source: SourceRef): boolean => {
    // There is only one Workspace per root, whatever its ID.
    const key = sourceKey(category, category === "workspace" ? "" : id);
    const existing = model.sources[key];
    if (existing) {
      const code =
        category === "workspace"
          ? "WORKSPACE_DUPLICATE"
          : category === "layout"
            ? "LAYOUT_DUPLICATE"
            : category === "collection"
              ? "COLLECTION_ID_CONFLICT"
              : "ID_DUPLICATE";
      const message =
        category === "workspace"
          ? `Only one Workspace resource is allowed per workspace root; '${id}' is ignored`
          : `Duplicate ${CATEGORY_LABEL[category]} ID '${id}'`;
      diagnostics.push(
        diagnostic("error", code, message, {
          file: source.file,
          document: source.document,
          path:
            source.path.length > 0
              ? [...source.path, category === "layout" ? "diagram" : "id"]
              : [category === "layout" ? "diagram" : "id"],
          hint: `First defined in ${existing.file}. IDs must be unique within the workspace.`,
          related: [{ file: existing.file, document: existing.document, path: existing.path }],
        }),
      );
      return false;
    }
    model.sources[key] = source;
    return true;
  };

  const ordered = [...parsed].sort((a, b) => compareSources(a.source, b.source));

  const markdown = (body: ParsedResource["body"], file: string) => {
    const b = body ?? { text: "", line: 1 };
    return { body: b, ...analyzeMarkdown(b, file) };
  };

  for (const { resource, source, body } of ordered) {
    switch (resource.kind) {
      case "Workspace":
        if (claim("workspace", resource.id, source)) {
          model.workspace = defined({
            id: resource.id,
            name: resource.name,
            description: resource.description,
            layoutDefaults: { ...(resource.defaults?.layout ?? {}) },
          });
        }
        break;
      case "Project":
        if (claim("project", resource.id, source)) {
          model.projects[resource.id] = defined({
            id: resource.id,
            name: resource.name,
            description: resource.description,
            owner: resource.owner,
            tags: [...(resource.tags ?? [])],
            properties: { ...(resource.properties ?? {}) },
          });
        }
        break;
      case "EntityType":
        if (claim("entityType", resource.id, source)) {
          model.entityTypes[resource.id] = defined({
            id: resource.id,
            name: resource.name,
            description: resource.description,
            extends: resource.extends,
            style: resource.style ? { ...resource.style } : undefined,
          });
        }
        break;
      case "RelationshipType":
        if (claim("relationshipType", resource.id, source)) {
          model.relationshipTypes[resource.id] = defined({
            id: resource.id,
            name: resource.name,
            description: resource.description,
            extends: resource.extends,
            sources: resource.sources ? [...resource.sources] : undefined,
            targets: resource.targets ? [...resource.targets] : undefined,
            style: resource.style ? { ...resource.style } : undefined,
          });
        }
        break;
      case "Entity": {
        const { apiVersion: _v, kind: _k, ...fields } = resource;
        if (claim("entity", fields.id, source))
          model.entities[fields.id] = toCanonicalEntity(fields);
        break;
      }
      case "EntitySet": {
        const members: string[] = [];
        resource.entities.forEach((fields, i) => {
          const itemSource = { ...source, path: [...source.path, "entities", i] };
          if (claim("entity", fields.id, itemSource)) {
            model.entities[fields.id] = toCanonicalEntity(fields);
            members.push(fields.id);
          }
        });
        if (claim("collection", resource.id, source)) {
          model.collections[resource.id] = defined({
            id: resource.id,
            kind: "EntitySet" as const,
            name: resource.name,
            description: resource.description,
            members,
          });
        }
        break;
      }
      case "RelationshipSet": {
        const members: string[] = [];
        resource.relationships.forEach((fields, i) => {
          const itemSource = { ...source, path: [...source.path, "relationships", i] };
          if (claim("relationship", fields.id, itemSource)) {
            model.relationships[fields.id] = toCanonicalRelationship(fields);
            members.push(fields.id);
          }
        });
        if (claim("collection", resource.id, source)) {
          model.collections[resource.id] = defined({
            id: resource.id,
            kind: "RelationshipSet" as const,
            name: resource.name,
            description: resource.description,
            members,
          });
        }
        break;
      }
      case "Diagram":
        if (claim("diagram", resource.id, source))
          model.diagrams[resource.id] = toCanonicalDiagram(resource);
        break;
      case "DiagramLayout":
        if (claim("layout", resource.diagram, source)) {
          model.layouts[resource.diagram] = {
            diagram: resource.diagram,
            settings: { ...(resource.settings ?? {}) },
            nodes: sortRecord(resource.nodes ?? {}),
            edges: sortRecord(resource.edges ?? {}),
          };
        }
        break;
      case "Document":
        if (claim("document", resource.id, source)) {
          model.documents[resource.id] = defined({
            id: resource.id,
            title: resource.title,
            description: resource.description,
            owner: resource.owner,
            tags: [...(resource.tags ?? [])],
            entities: [...(resource.entities ?? [])],
            diagrams: [...(resource.diagrams ?? [])],
            properties: { ...(resource.properties ?? {}) },
            ...markdown(body, source.file),
          });
        }
        break;
      case "Decision":
        if (claim("decision", resource.id, source)) {
          model.decisions[resource.id] = defined({
            id: resource.id,
            title: resource.title,
            status: resource.status,
            date: resource.date,
            description: resource.description,
            deciders: [...(resource.deciders ?? [])],
            tags: [...(resource.tags ?? [])],
            entities: [...(resource.entities ?? [])],
            diagrams: [...(resource.diagrams ?? [])],
            supersedes: [...(resource.supersedes ?? [])],
            properties: { ...(resource.properties ?? {}) },
            ...markdown(body, source.file),
          });
        }
        break;
    }
  }

  return {
    model: {
      workspace: model.workspace,
      projects: sortRecord(model.projects),
      entityTypes: sortRecord(model.entityTypes),
      relationshipTypes: sortRecord(model.relationshipTypes),
      entities: sortRecord(model.entities),
      relationships: sortRecord(model.relationships),
      diagrams: sortRecord(model.diagrams),
      layouts: sortRecord(model.layouts),
      collections: sortRecord(model.collections),
      documents: sortRecord(model.documents),
      decisions: sortRecord(model.decisions),
      sources: sortRecord(model.sources),
    },
    diagnostics,
  };
}
