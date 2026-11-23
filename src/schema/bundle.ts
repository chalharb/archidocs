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
  relationships: z.array(z.never()),
  targets: z.array(BundleTarget),
  deployments: z.array(BundleDeployment),
});

export type Bundle = z.infer<typeof Bundle>;
export type BundleElement = z.infer<typeof BundleElement>;
export type BundleTarget = z.infer<typeof BundleTarget>;
export type BundleDeployment = z.infer<typeof BundleDeployment>;
