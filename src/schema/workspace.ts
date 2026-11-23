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

/** An Element reference: a bare id in its own Project, or `project:id` across Projects. */
export const ElementRef = z
  .string()
  .regex(/^([a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9-]*$/, "must be an Element id, or `project:id` for one in another Project");

/**
 * A dependency of the Element it is declared under (the consumer) on the
 * Element `to` names (the provider). An async one may run through a broker
 * Service (`via`) on a topic or queue (`channel`).
 */
export const Relationship = z.strictObject({
  to: ElementRef,
  id: Id.optional(),
  description: z.string().optional(),
  technology: z.string().optional(),
  interaction: z.enum(["sync", "async"]).optional(),
  via: ElementRef.optional(),
  channel: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const elementFields = {
  name: z.string(),
  description: z.string().optional(),
  owner: Id.optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(Link).optional(),
  relationships: z.array(Relationship).optional(),
};

/** Names the parent of a top-level Service or Component declared in another file. */
const parentRef = Id.describe("Id of the parent declared in another file of this Project");

export const Person = z.strictObject({ ...elementFields });

export const Component = z.strictObject({
  ...elementFields,
  technology: z.string().optional(),
  in: parentRef.optional(),
});

export const Service = z.strictObject({
  ...elementFields,
  type: z.enum(["app", "datastore", "broker"]).optional(),
  technology: z.string().optional(),
  external: z.boolean().optional(),
  in: parentRef.optional(),
  components: z.record(Id, Component).optional(),
});

export const System = z.strictObject({
  ...elementFields,
  external: z.boolean().optional(),
  services: z.record(Id, Service).optional(),
});

/**
 * Any other `*.yaml` in a Project: `people`, `systems > services > components`,
 * and top-level `services` and `components` (which attach with `in:`).
 * This full, nested form is what editors validate against.
 */
export const ModelFile = z.strictObject({
  people: z.record(Id, Person).optional(),
  systems: z.record(Id, System).optional(),
  services: z.record(Id, Service).optional(),
  components: z.record(Id, Component).optional(),
});

export type ElementKind = "person" | "system" | "service" | "component";

/** The map key each kind is declared under. */
export const collectionOf = { person: "people", system: "systems", service: "services", component: "components" } as const satisfies Record<ElementKind, string>;

export const kindOfCollection: Record<string, ElementKind> = Object.fromEntries(
  Object.entries(collectionOf).map(([kind, key]) => [key, kind as ElementKind]),
);

/** The kind each kind may contain, if any: System › Service › Component. */
export const childKindOf: Record<ElementKind, ElementKind | undefined> = {
  person: undefined,
  system: "service",
  service: "component",
  component: undefined,
};

/** The kind a top-level `in:` must name, for kinds that can attach with it. */
export const parentKindOf: Record<ElementKind, ElementKind | undefined> = {
  person: undefined,
  system: undefined,
  service: "system",
  component: "service",
};

const children = z.record(Id, z.unknown()).optional();

/**
 * Shallow forms used by Load: each Element is checked on its own, with its
 * children left to their own checks, so one bad declaration still registers
 * its id and nothing is reported twice.
 */
export const shallow = {
  file: z.strictObject({ people: children, systems: children, services: children, components: children }),
  person: Person,
  system: System.extend({ services: children }),
  service: Service.extend({ components: children }),
  component: Component,
} as const;

/** Top-level keys that may appear only in `workspace.yaml`. */
export const workspaceOnlyKeys = ["teams", "environments"] as const;

export type TeamInput = z.infer<typeof Team>;
export type EnvironmentInput = z.infer<typeof Environment>;
export type RelationshipInput = z.infer<typeof Relationship>;
export type ServiceInput = z.infer<typeof Service>;
export type ModelFileInput = z.infer<typeof ModelFile>;
