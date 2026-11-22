import { z } from "zod";

export const SCHEMA_VERSION = 1;

const Source = z.object({ file: z.string(), line: z.number().int() });
const Link = z.object({ label: z.string(), url: z.string() });

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
  elements: z.array(
    z.object({
      id: z.string(),
      kind: z.literal("service"),
      parent: z.string().nullable(),
      name: z.string(),
      description: z.string().nullable(),
      owner: z.string(),
      tags: z.array(z.string()),
      links: z.array(Link),
      type: z.enum(["app", "datastore", "broker"]),
      technology: z.string().nullable(),
      external: z.boolean(),
      source: Source,
    }),
  ),
  relationships: z.array(z.never()),
  targets: z.array(z.never()),
  deployments: z.array(z.never()),
});

export type Bundle = z.infer<typeof Bundle>;
export type BundleElement = Bundle["elements"][number];
