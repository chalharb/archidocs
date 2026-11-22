import { z } from "zod";

/** An author-chosen slug: Team, Environment, Project and Element ids. */
export const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug (a-z, 0-9 and -)");

export const Link = z.strictObject({
  label: z.string(),
  url: z.url(),
});

export const Team = z.strictObject({
  name: z.string(),
  description: z.string().optional(),
  links: z.array(Link).optional(),
});

export const Environment = z.strictObject({
  name: z.string(),
  description: z.string().optional(),
});

/** `workspace.yaml`: the only place Teams and Environments are defined. */
export const WorkspaceFile = z.strictObject({
  teams: z.record(Id, Team).optional(),
  environments: z.record(Id, Environment).optional(),
});

/** `project.yaml`: marks a folder as a Project. */
export const ProjectFile = z.strictObject({
  id: Id,
  name: z.string(),
  owner: Id,
});

export const Service = z.strictObject({
  name: z.string(),
  description: z.string().optional(),
  owner: Id.optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(Link).optional(),
  type: z.enum(["app", "datastore", "broker"]).optional(),
  technology: z.string().optional(),
  external: z.boolean().optional(),
});

/**
 * Any other `*.yaml` in a Project. Elements are checked one by one against
 * their own schema, so one bad declaration still registers its id.
 */
export const ModelFile = z.strictObject({
  services: z.record(Id, z.unknown()).optional(),
});

/** Top-level keys that may appear only in `workspace.yaml`. */
export const workspaceOnlyKeys = ["teams", "environments"] as const;

export type TeamInput = z.infer<typeof Team>;
export type EnvironmentInput = z.infer<typeof Environment>;
export type ServiceInput = z.infer<typeof Service>;
