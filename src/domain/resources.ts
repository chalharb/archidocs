/**
 * Canonical TypeScript contracts for the `archdocs/v1` YAML resource kinds (P0-02).
 *
 * These interfaces describe resources exactly as authored. The Zod schemas in
 * `schema/` are checked against them at compile time, so the two cannot drift.
 * Field-level design is recorded in docs/addenda/ADD-001-archdocs-v1-schema.md.
 */

export const API_VERSION = "archdocs/v1" as const;
export type ApiVersion = typeof API_VERSION;

export const RESOURCE_KINDS = [
  "Workspace",
  "Project",
  "Entity",
  "EntitySet",
  "EntityType",
  "RelationshipSet",
  "RelationshipType",
  "Diagram",
  "DiagramLayout",
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

/** JSON-compatible value used for custom metadata (MODEL-05). */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type CustomProperties = Record<string, JsonValue>;

// ---------------------------------------------------------------------------
// Layout settings (PRD §4)
// ---------------------------------------------------------------------------

export const LAYOUT_DIRECTIONS = ["DOWN", "UP", "LEFT", "RIGHT"] as const;
export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];

export const EDGE_TYPES = ["straight", "bezier", "step", "smoothstep"] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export interface LayoutSettings {
  direction: LayoutDirection;
  nodeSpacing: number;
  layerSpacing: number;
  edgeType: EdgeType;
  gridSize: number;
  snapToGrid: boolean;
  nodeWidth: number;
  nodeHeight: number;
}

export type LayoutSettingsOverrides = Partial<LayoutSettings>;

// ---------------------------------------------------------------------------
// Resource bodies
// ---------------------------------------------------------------------------

interface ResourceHeader<K extends ResourceKind> {
  apiVersion: ApiVersion;
  kind: K;
}

/** Entity fields shared verbatim by `Entity` and `EntitySet` entries (SCHEMA-02). */
export interface EntityFields {
  id: string;
  name: string;
  type: string;
  description?: string;
  parent?: string;
  project?: string;
  technology?: string;
  owner?: string;
  tags?: string[];
  properties?: CustomProperties;
}

export interface RelationshipFields {
  id: string;
  type: string;
  source: string;
  target: string;
  description?: string;
  technology?: string;
  tags?: string[];
  properties?: CustomProperties;
}

export interface WorkspaceResource extends ResourceHeader<"Workspace"> {
  id: string;
  name: string;
  description?: string;
  defaults?: { layout?: LayoutSettingsOverrides };
}

export interface ProjectResource extends ResourceHeader<"Project"> {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  tags?: string[];
  properties?: CustomProperties;
}

export interface EntityResource extends ResourceHeader<"Entity">, EntityFields {}

export interface EntitySetResource extends ResourceHeader<"EntitySet"> {
  id: string;
  name?: string;
  description?: string;
  entities: EntityFields[];
}

export interface EntityTypeResource extends ResourceHeader<"EntityType"> {
  id: string;
  name: string;
  description?: string;
  extends?: string;
}

export interface RelationshipTypeResource extends ResourceHeader<"RelationshipType"> {
  id: string;
  name: string;
  description?: string;
  extends?: string;
  /** Allowed source entity types; subtypes are accepted (SCHEMA-06). Omitted = any. */
  sources?: string[];
  /** Allowed target entity types; subtypes are accepted (SCHEMA-06). Omitted = any. */
  targets?: string[];
}

export interface RelationshipSetResource extends ResourceHeader<"RelationshipSet"> {
  id: string;
  name?: string;
  description?: string;
  relationships: RelationshipFields[];
}

export const DIAGRAM_TYPES = [
  "c4-context",
  "c4-container",
  "c4-component",
  "network",
  "deployment",
  "custom",
] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export interface DiagramNodeSpec {
  /** View-instance ID, unique within the diagram. Defaults to `entity`. */
  id?: string;
  /** Canonical entity this instance renders (DIAG-08). */
  entity: string;
  label?: string;
}

export interface DiagramEdgeSpec {
  /** Edge ID, unique within the diagram. Defaults to `relationship`. */
  id?: string;
  relationship: string;
  /** Source view-instance ID; required when the source entity appears more than once. */
  source?: string;
  /** Target view-instance ID; required when the target entity appears more than once. */
  target?: string;
  label?: string;
}

export interface DiagramResource extends ResourceHeader<"Diagram"> {
  id: string;
  name: string;
  diagramType: DiagramType;
  description?: string;
  layout?: LayoutSettingsOverrides;
  nodes: DiagramNodeSpec[];
  edges?: DiagramEdgeSpec[];
}

export interface NodePlacement {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface EdgePresentation {
  type?: EdgeType;
}

export interface DiagramLayoutResource extends ResourceHeader<"DiagramLayout"> {
  diagram: string;
  settings?: LayoutSettingsOverrides;
  nodes?: Record<string, NodePlacement>;
  edges?: Record<string, EdgePresentation>;
}

export type Resource =
  | WorkspaceResource
  | ProjectResource
  | EntityResource
  | EntitySetResource
  | EntityTypeResource
  | RelationshipSetResource
  | RelationshipTypeResource
  | DiagramResource
  | DiagramLayoutResource;

export type ResourceOfKind<K extends ResourceKind> = Extract<Resource, { kind: K }>;

/** Where a resource (or an item within one) was defined. */
export interface SourceRef {
  file: string;
  document: number;
  path: Array<string | number>;
}

export interface ParsedResource {
  resource: Resource;
  source: SourceRef;
}
