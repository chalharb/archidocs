/**
 * Normalized canonical model (P0-02). Produced by `normalize()` from parsed resources.
 *
 * All collections are plain records whose keys are inserted in sorted order, so
 * the model is JSON-serializable and its serialization is deterministic (SCHEMA-09).
 * Source locations live in `sources`, not on the items, so an entity defined
 * individually and one defined in an EntitySet are structurally identical (SCHEMA-02).
 */
import type {
  CustomProperties,
  DiagramType,
  EdgePresentation,
  ElementStyle,
  LayoutSettingsOverrides,
  NodePlacement,
  RelationshipStyle,
  SourceRef,
} from "./resources";

export interface CanonicalWorkspace {
  id: string;
  name: string;
  description?: string;
  layoutDefaults: LayoutSettingsOverrides;
}

export interface CanonicalProject {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  tags: string[];
  properties: CustomProperties;
}

export interface CanonicalEntityType {
  id: string;
  name: string;
  description?: string;
  extends?: string;
  style?: ElementStyle;
}

export interface CanonicalRelationshipType {
  id: string;
  name: string;
  description?: string;
  extends?: string;
  sources?: string[];
  targets?: string[];
  style?: RelationshipStyle;
}

export interface CanonicalEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  parent?: string;
  project?: string;
  technology?: string;
  owner?: string;
  tags: string[];
  properties: CustomProperties;
  style?: ElementStyle;
}

export interface CanonicalRelationship {
  id: string;
  type: string;
  source: string;
  target: string;
  description?: string;
  technology?: string;
  tags: string[];
  properties: CustomProperties;
  style?: RelationshipStyle;
}

/** A diagram node is a *view instance* of a canonical entity (DIAG-09). */
export interface DiagramViewInstance {
  id: string;
  entity: string;
  label?: string;
}

export interface DiagramEdgeInstance {
  id: string;
  relationship: string;
  source?: string;
  target?: string;
  label?: string;
}

export interface CanonicalDiagram {
  id: string;
  name: string;
  diagramType: DiagramType;
  description?: string;
  layout: LayoutSettingsOverrides;
  nodes: DiagramViewInstance[];
  edges: DiagramEdgeInstance[];
}

export interface CanonicalDiagramLayout {
  diagram: string;
  settings: LayoutSettingsOverrides;
  nodes: Record<string, NodePlacement>;
  edges: Record<string, EdgePresentation>;
}

export interface CanonicalCollection {
  id: string;
  kind: "EntitySet" | "RelationshipSet";
  name?: string;
  description?: string;
  members: string[];
}

export type ModelCategory =
  | "workspace"
  | "project"
  | "entityType"
  | "relationshipType"
  | "entity"
  | "relationship"
  | "diagram"
  | "layout"
  | "collection";

export interface ArchitectureModel {
  workspace: CanonicalWorkspace | null;
  projects: Record<string, CanonicalProject>;
  entityTypes: Record<string, CanonicalEntityType>;
  relationshipTypes: Record<string, CanonicalRelationshipType>;
  entities: Record<string, CanonicalEntity>;
  relationships: Record<string, CanonicalRelationship>;
  diagrams: Record<string, CanonicalDiagram>;
  /** Keyed by diagram ID. */
  layouts: Record<string, CanonicalDiagramLayout>;
  collections: Record<string, CanonicalCollection>;
  /** Source of each item, keyed by `${category}:${id}`. */
  sources: Record<string, SourceRef>;
}

export function sourceKey(category: ModelCategory, id: string): string {
  return `${category}:${id}`;
}

export function emptyModel(): ArchitectureModel {
  return {
    workspace: null,
    projects: {},
    entityTypes: {},
    relationshipTypes: {},
    entities: {},
    relationships: {},
    diagrams: {},
    layouts: {},
    collections: {},
    sources: {},
  };
}
