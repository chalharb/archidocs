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

const elementFields = {
  name: z.string(),
  description: z.string().optional(),
  owner: Id.optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(Link).optional(),
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

/** A reference to an Element or Deployment Target: a bare id in its own Project, or `project:id`. */
export const Ref = z
  .string()
  .regex(/^([a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9-]*$/, "must be an id, or `project:id` for one in another Project")
  .describe("An id in this Project, or `project:id` for one in another Project");

const targetFields = {
  name: z.string(),
  kind: z.string().describe("What the Target is, such as region, cluster, namespace or platform"),
  description: z.string().optional(),
  owner: Id.optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(Link).optional(),
};

/** A Deployment Target: where Services run. Targets nest to any depth and are not Elements. */
export const Target: z.ZodType<TargetInput> = z
  .strictObject({
    ...targetFields,
    get targets() {
      return z.record(Id, Target).optional();
    },
  })
  .meta({ id: "Target" });

export interface TargetInput {
  name: string;
  kind: string;
  description?: string;
  owner?: string;
  tags?: string[];
  links?: z.infer<typeof Link>[];
  targets?: Record<string, TargetInput>;
}

export const Endpoint = z.strictObject({
  name: z.string(),
  url: z.url(),
});

/** One Service running in one Environment on one Deployment Target. */
export const Deployment = z.strictObject({
  service: Ref,
  environment: Id,
  target: Ref,
  url: z.url().optional(),
  endpoints: z.array(Endpoint).optional(),
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
  targets: z.record(Id, Target).optional(),
  deployments: z.array(Deployment).optional(),
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
  file: z.strictObject({
    people: children,
    systems: children,
    services: children,
    components: children,
    targets: children,
    deployments: z.array(z.unknown()).optional(),
  }),
  target: z.strictObject({ ...targetFields, targets: children }),
  deployment: Deployment,
  person: Person,
  system: System.extend({ services: children }),
  service: Service.extend({ components: children }),
  component: Component,
} as const;

/** Top-level keys that may appear only in `workspace.yaml`. */
export const workspaceOnlyKeys = ["teams", "environments"] as const;

export type TeamInput = z.infer<typeof Team>;
export type EnvironmentInput = z.infer<typeof Environment>;
export type ServiceInput = z.infer<typeof Service>;
export type ModelFileInput = z.infer<typeof ModelFile>;
