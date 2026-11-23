import { z } from "zod";

export const SCHEMA_VERSION = 1;

const Source = z.object({ file: z.string(), line: z.number().int() });
const Link = z.object({ label: z.string(), url: z.string() });

const elementFields = {
  id: z.string(),
  parent: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  owner: z.string(),
  tags: z.array(z.string()),
  links: z.array(Link),
};

/**
 * One Element: qualified id, kind, parent (qualified id or null), the
 * effective Owner, then the kind's own fields. Keys are in this fixed order.
 */
const element = <K extends string, F extends z.ZodRawShape>(kind: K, fields: F) => {
  const { id, ...rest } = elementFields;
  return z.object({ id, kind: z.literal(kind), ...rest, ...fields, source: Source });
};

export const BundleElement = z.discriminatedUnion("kind", [
  element("person", {}),
  element("system", { external: z.boolean() }),
  element("service", { type: z.enum(["app", "datastore", "broker"]), technology: z.string().nullable(), external: z.boolean() }),
  element("component", { technology: z.string().nullable() }),
]);

/** A Deployment Target: qualified id, parent Target (qualified id or null) and its effective Owner. */
export const BundleTarget = z.object({
  id: z.string(),
  parent: z.string().nullable(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
  owner: z.string(),
  tags: z.array(z.string()),
  links: z.array(Link),
  source: Source,
});

/** A Deployment, identified by its (service, environment, target) triple; its Owner is its Service's. */
export const BundleDeployment = z.object({
  service: z.string(),
  environment: z.string(),
  target: z.string(),
  url: z.string().nullable(),
  endpoints: z.array(z.object({ name: z.string(), url: z.string() })),
  owner: z.string(),
  source: Source,
});

/**
 * One declared Relationship, consumer (`from`) → provider (`to`), all ids
 * qualified. `id` is the author's optional id, qualified with the consumer's
 * Project. Derived edges are never stored.
 */
export const BundleRelationship = z.object({
  id: z.string().nullable(),
  from: z.string(),
  to: z.string(),
  description: z.string().nullable(),
  technology: z.string().nullable(),
  interaction: z.enum(["sync", "async"]),
  via: z.string().nullable(),
  channel: z.string().nullable(),
  tags: z.array(z.string()),
  source: Source,
});

const BundleRef = z.string();
const Hops = z.union([z.number(), z.literal("all")]);
const Paths = z.union([z.literal("shortest"), z.number()]);
const PathSelector = z.object({ from: BundleRef, to: BundleRef, paths: Paths.optional() });

/** A selector with its Element ids qualified; a bare id is the Element itself. */
export const BundleSelector = z.union([
  BundleRef,
  z.object({ element: BundleRef, with: z.enum(["children", "descendants"]).optional(), upstream: Hops.optional(), downstream: Hops.optional() }),
  z.object({ team: z.string() }),
  z.object({ tag: z.string() }),
  PathSelector,
]);

export const BundleLens = z.union([
  z.object({ impact: BundleRef, direction: z.enum(["upstream", "downstream", "both"]) }),
  z.object({ team: z.string() }),
  z.object({ path: PathSelector }),
]);

/**
 * A Saved structural or Deployment View's definition, every id qualified; not
 * its resolved nodes. `include` is null when absent (every Element).
 */
export const BundleView = z.object({
  id: z.string(),
  project: z.string(),
  kind: z.literal("structural"),
  title: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  level: z.enum(["c1", "c2", "c3", "deployment"]),
  include: z.array(BundleSelector).nullable(),
  exclude: z.array(BundleSelector),
  expand: z.array(z.string()),
  collapse: z.array(z.string()),
  direction: z.enum(["TB", "BT", "LR", "RL"]).nullable(),
  lens: BundleLens.nullable(),
  environment: z.string().nullable(),
  targets: z.array(z.string()),
  source: Source,
});

/**
 * The Workspace Bundle. Parsing through this schema also fixes key order,
 * since zod emits object keys in shape order.
 */
export const Bundle = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  commit: z.string().nullable(),
  builtAt: z.string().nullable(),
  teams: z.array(
    z.object({ id: z.string(), name: z.string(), description: z.string().nullable(), links: z.array(Link), source: Source }),
  ),
  environments: z.array(
    z.object({ id: z.string(), name: z.string(), description: z.string().nullable(), source: Source }),
  ),
  projects: z.array(
    z.object({ id: z.string(), name: z.string(), owner: z.string(), folder: z.string(), source: Source }),
  ),
  elements: z.array(BundleElement),
  relationships: z.array(BundleRelationship),
  targets: z.array(BundleTarget),
  deployments: z.array(BundleDeployment),
  views: z.array(BundleView),
});

export type Bundle = z.infer<typeof Bundle>;
export type BundleElement = z.infer<typeof BundleElement>;
export type BundleRelationship = z.infer<typeof BundleRelationship>;
export type BundleTarget = z.infer<typeof BundleTarget>;
export type BundleDeployment = z.infer<typeof BundleDeployment>;
export type BundleView = z.infer<typeof BundleView>;
export type BundleSelector = z.infer<typeof BundleSelector>;
export type BundleLens = z.infer<typeof BundleLens>;
