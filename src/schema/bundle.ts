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
  targets: z.array(z.never()),
  deployments: z.array(z.never()),
});

export type Bundle = z.infer<typeof Bundle>;
export type BundleElement = z.infer<typeof BundleElement>;
export type BundleRelationship = z.infer<typeof BundleRelationship>;
