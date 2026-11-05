/**
 * Strict Zod schemas for every `archdocs/v1` resource kind (SCHEMA-01).
 *
 * Every object is strict: unknown keys are rejected (SCHEMA-08) except inside
 * `properties`, which is the explicitly permitted home for custom metadata (MODEL-05).
 */
import { z } from "zod";
import {
  API_VERSION,
  DECISION_STATUSES,
  DIAGRAM_TYPES,
  EDGE_TYPES,
  ELEMENT_SHAPES,
  LAYOUT_DIRECTIONS,
  LINE_STYLES,
  STYLE_COLORS,
  type ElementStyle,
  type RelationshipStyle,
  type DiagramLayoutResource,
  type DiagramResource,
  type DecisionResource,
  type DocumentResource,
  type EntityFields,
  type EntityResource,
  type EntitySetResource,
  type EntityTypeResource,
  type JsonValue,
  type LayoutSettings,
  type ProjectResource,
  type RelationshipFields,
  type RelationshipSetResource,
  type RelationshipTypeResource,
  type ResourceKind,
  type WorkspaceResource,
} from "../resources";

export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const ID_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 10_000;
export const TAG_MAX_LENGTH = 64;
export const MAX_TAGS = 64;
export const MAX_COLLECTION_ITEMS = 10_000;
export const COORDINATE_LIMIT = 1_000_000;

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const idSchema = z
  .string()
  .min(1)
  .max(ID_MAX_LENGTH)
  .regex(
    ID_PATTERN,
    "IDs must start with a letter or digit and contain only letters, digits, '.', '_' or '-'",
  );

const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);
const descriptionSchema = z.string().max(DESCRIPTION_MAX_LENGTH);
const shortTextSchema = z.string().min(1).max(NAME_MAX_LENGTH);
const tagsSchema = z.array(z.string().min(1).max(TAG_MAX_LENGTH)).max(MAX_TAGS);

const propertyKeySchema = z
  .string()
  .min(1)
  .max(ID_MAX_LENGTH)
  .refine((k) => !FORBIDDEN_KEYS.has(k), "Reserved property name");

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(propertyKeySchema, jsonValueSchema),
  ]),
);

const propertiesSchema = z.record(propertyKeySchema, jsonValueSchema);

const header = <K extends ResourceKind>(kind: K) => ({
  apiVersion: z.literal(API_VERSION),
  kind: z.literal(kind),
});

// ---------------------------------------------------------------------------
// Layout settings
// ---------------------------------------------------------------------------

export const layoutSettingsSchema = z.strictObject({
  direction: z.enum(LAYOUT_DIRECTIONS),
  nodeSpacing: z.number().min(0).max(1000),
  layerSpacing: z.number().min(0).max(1000),
  edgeType: z.enum(EDGE_TYPES),
  gridSize: z.number().int().min(1).max(200),
  snapToGrid: z.boolean(),
  nodeWidth: z.number().min(10).max(2000),
  nodeHeight: z.number().min(10).max(2000),
  animateEdges: z.boolean(),
  showMinimap: z.boolean(),
});

export const layoutSettingsOverridesSchema = layoutSettingsSchema.partial();

// ---------------------------------------------------------------------------
// Styles (DIAG-11, ADD-004)
// ---------------------------------------------------------------------------

export const elementStyleSchema = z.strictObject({
  shape: z.enum(ELEMENT_SHAPES).optional(),
  color: z.enum(STYLE_COLORS).optional(),
});

export const relationshipStyleSchema = z.strictObject({
  line: z.enum(LINE_STYLES).optional(),
  color: z.enum(STYLE_COLORS).optional(),
});

// ---------------------------------------------------------------------------
// Entities and relationships
// ---------------------------------------------------------------------------

export const entityFieldsShape = {
  id: idSchema,
  name: nameSchema,
  type: idSchema,
  description: descriptionSchema.optional(),
  parent: idSchema.optional(),
  project: idSchema.optional(),
  technology: shortTextSchema.optional(),
  owner: shortTextSchema.optional(),
  tags: tagsSchema.optional(),
  properties: propertiesSchema.optional(),
  style: elementStyleSchema.optional(),
};

export const entityFieldsSchema = z.strictObject(entityFieldsShape);

export const relationshipFieldsSchema = z.strictObject({
  id: idSchema,
  type: idSchema,
  source: idSchema,
  target: idSchema,
  description: descriptionSchema.optional(),
  technology: shortTextSchema.optional(),
  tags: tagsSchema.optional(),
  properties: propertiesSchema.optional(),
  style: relationshipStyleSchema.optional(),
});

// ---------------------------------------------------------------------------
// Resource kinds
// ---------------------------------------------------------------------------

export const workspaceSchema = z.strictObject({
  ...header("Workspace"),
  id: idSchema,
  name: nameSchema,
  description: descriptionSchema.optional(),
  defaults: z.strictObject({ layout: layoutSettingsOverridesSchema.optional() }).optional(),
});

export const projectSchema = z.strictObject({
  ...header("Project"),
  id: idSchema,
  name: nameSchema,
  description: descriptionSchema.optional(),
  owner: shortTextSchema.optional(),
  tags: tagsSchema.optional(),
  properties: propertiesSchema.optional(),
});

export const entitySchema = z.strictObject({ ...header("Entity"), ...entityFieldsShape });

export const entitySetSchema = z.strictObject({
  ...header("EntitySet"),
  id: idSchema,
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  entities: z.array(entityFieldsSchema).max(MAX_COLLECTION_ITEMS),
});

export const entityTypeSchema = z.strictObject({
  ...header("EntityType"),
  id: idSchema,
  name: nameSchema,
  description: descriptionSchema.optional(),
  extends: idSchema.optional(),
  style: elementStyleSchema.optional(),
});

export const relationshipTypeSchema = z.strictObject({
  ...header("RelationshipType"),
  id: idSchema,
  name: nameSchema,
  description: descriptionSchema.optional(),
  extends: idSchema.optional(),
  sources: z.array(idSchema).min(1).max(MAX_TAGS).optional(),
  targets: z.array(idSchema).min(1).max(MAX_TAGS).optional(),
  style: relationshipStyleSchema.optional(),
});

export const relationshipSetSchema = z.strictObject({
  ...header("RelationshipSet"),
  id: idSchema,
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  relationships: z.array(relationshipFieldsSchema).max(MAX_COLLECTION_ITEMS),
});

export const diagramNodeSchema = z.strictObject({
  id: idSchema.optional(),
  entity: idSchema,
  label: shortTextSchema.optional(),
});

export const diagramEdgeSchema = z.strictObject({
  id: idSchema.optional(),
  relationship: idSchema,
  source: idSchema.optional(),
  target: idSchema.optional(),
  label: shortTextSchema.optional(),
});

export const diagramSchema = z.strictObject({
  ...header("Diagram"),
  id: idSchema,
  name: nameSchema,
  diagramType: z.enum(DIAGRAM_TYPES),
  description: descriptionSchema.optional(),
  layout: layoutSettingsOverridesSchema.optional(),
  nodes: z.array(diagramNodeSchema).max(MAX_COLLECTION_ITEMS),
  edges: z.array(diagramEdgeSchema).max(MAX_COLLECTION_ITEMS).optional(),
});

const coordinateSchema = z.number().min(-COORDINATE_LIMIT).max(COORDINATE_LIMIT);
const dimensionSchema = z.number().positive().max(COORDINATE_LIMIT);

export const nodePlacementSchema = z.strictObject({
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema.optional(),
  height: dimensionSchema.optional(),
});

export const edgePresentationSchema = z.strictObject({
  type: z.enum(EDGE_TYPES).optional(),
  animated: z.boolean().optional(),
});

export const diagramLayoutSchema = z.strictObject({
  ...header("DiagramLayout"),
  diagram: idSchema,
  settings: layoutSettingsOverridesSchema.optional(),
  nodes: z.record(idSchema, nodePlacementSchema).optional(),
  edges: z.record(idSchema, edgePresentationSchema).optional(),
});

// ---------------------------------------------------------------------------
// Documents and decisions (DOC-02, ADR-01, ADD-009)
// ---------------------------------------------------------------------------

const idListSchema = z.array(idSchema).max(MAX_COLLECTION_ITEMS);

/** `YYYY-MM-DD` naming a real calendar date. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be written as YYYY-MM-DD")
  .refine((d) => {
    const parsed = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(d);
  }, "Not a real calendar date");

export const documentSchema = z.strictObject({
  ...header("Document"),
  id: idSchema,
  title: nameSchema,
  description: descriptionSchema.optional(),
  owner: shortTextSchema.optional(),
  tags: tagsSchema.optional(),
  entities: idListSchema.optional(),
  diagrams: idListSchema.optional(),
  properties: propertiesSchema.optional(),
});

export const decisionSchema = z.strictObject({
  ...header("Decision"),
  id: idSchema,
  title: nameSchema,
  status: z.enum(DECISION_STATUSES),
  date: isoDateSchema,
  description: descriptionSchema.optional(),
  deciders: z.array(shortTextSchema).max(MAX_TAGS).optional(),
  tags: tagsSchema.optional(),
  entities: idListSchema.optional(),
  diagrams: idListSchema.optional(),
  supersedes: idListSchema.optional(),
  properties: propertiesSchema.optional(),
});

export const RESOURCE_SCHEMAS = {
  Workspace: workspaceSchema,
  Project: projectSchema,
  Entity: entitySchema,
  EntitySet: entitySetSchema,
  EntityType: entityTypeSchema,
  RelationshipSet: relationshipSetSchema,
  RelationshipType: relationshipTypeSchema,
  Diagram: diagramSchema,
  DiagramLayout: diagramLayoutSchema,
  Document: documentSchema,
  Decision: decisionSchema,
} as const satisfies Record<ResourceKind, z.ZodType>;

// ---------------------------------------------------------------------------
// Compile-time contract checks: schema output must equal the declared interface.
// ---------------------------------------------------------------------------

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export type SchemaContractChecks = [
  Assert<Equals<z.output<typeof layoutSettingsSchema>, LayoutSettings>>,
  Assert<Equals<z.output<typeof elementStyleSchema>, ElementStyle>>,
  Assert<Equals<z.output<typeof relationshipStyleSchema>, RelationshipStyle>>,
  Assert<Equals<z.output<typeof entityFieldsSchema>, EntityFields>>,
  Assert<Equals<z.output<typeof relationshipFieldsSchema>, RelationshipFields>>,
  Assert<Equals<z.output<typeof workspaceSchema>, WorkspaceResource>>,
  Assert<Equals<z.output<typeof projectSchema>, ProjectResource>>,
  Assert<Equals<z.output<typeof entitySchema>, EntityResource>>,
  Assert<Equals<z.output<typeof entitySetSchema>, EntitySetResource>>,
  Assert<Equals<z.output<typeof entityTypeSchema>, EntityTypeResource>>,
  Assert<Equals<z.output<typeof relationshipTypeSchema>, RelationshipTypeResource>>,
  Assert<Equals<z.output<typeof relationshipSetSchema>, RelationshipSetResource>>,
  Assert<Equals<z.output<typeof diagramSchema>, DiagramResource>>,
  Assert<Equals<z.output<typeof diagramLayoutSchema>, DiagramLayoutResource>>,
  Assert<Equals<z.output<typeof documentSchema>, DocumentResource>>,
  Assert<Equals<z.output<typeof decisionSchema>, DecisionResource>>,
];
