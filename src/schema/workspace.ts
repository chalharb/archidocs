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

/** A reference to an Element or Deployment Target: a bare id in its own Project, or `project:id`. */
export const Ref = z
  .string()
  .regex(/^([a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9-]*$/, "must be an id, or `project:id` for one in another Project")
  .describe("An id in this Project, or `project:id` for one in another Project");

/**
 * A dependency of the Element it is declared under (the consumer) on the
 * Element `to` names (the provider). An async one may run through a broker
 * Service (`via`) on a topic or queue (`channel`).
 */
export const Relationship = z.strictObject({
  to: Ref,
  id: Id.optional(),
  description: z.string().optional(),
  technology: z.string().optional(),
  interaction: z.enum(["sync", "async"]).optional(),
  via: Ref.optional(),
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

/** How far `upstream` or `downstream` reaches: a number of hops, or `all` for the full transitive closure. */
const Hops = z.union([z.number().int().min(0), z.literal("all")], { error: "must be a number of hops, or `all`" }).describe("A number of hops, or `all`");

/** Which paths a path selector or Lens takes: the shortest, or every path of at most n hops. */
const Paths = z.union([z.literal("shortest"), z.number().int().min(1)], { error: "must be `shortest`, or a number of hops" }).describe("`shortest` (the default), or n for every path of at most n hops");

/** `{element}`: an Element, optionally with its children or descendants, and what it reaches upstream or downstream. */
export const ElementSelector = z.strictObject({
  element: Ref,
  with: z.enum(["children", "descendants"]).optional(),
  upstream: Hops.optional(),
  downstream: Hops.optional(),
});

/** `{team}`: every Element the Team owns. */
export const TeamSelector = z.strictObject({ team: Id });

/** `{tag}`: every Element carrying the tag. */
export const TagSelector = z.strictObject({ tag: z.string() });

/** `{from, to}`: every Element on the paths between two Elements, as `find_paths` follows them. */
export const PathSelector = z.strictObject({ from: Ref, to: Ref, paths: Paths.optional() });

/** One entry of a Saved View's `include` or `exclude`: a bare id is the Element itself. */
export const Selector = z.union([Ref, ElementSelector, TeamSelector, TagSelector, PathSelector]);

/** The schema a selector as written is checked against, picked by its keys, so a mistake is reported against the form meant. */
export function selectorSchemaFor(value: unknown): z.ZodType | undefined {
  if (typeof value === "string") return Ref;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  if ("element" in value) return ElementSelector;
  if ("team" in value) return TeamSelector;
  if ("tag" in value) return TagSelector;
  if ("from" in value || "to" in value) return PathSelector;
  return undefined;
}

export const ImpactLens = z.strictObject({ impact: Ref, direction: z.enum(["upstream", "downstream", "both"]).optional() });
export const TeamLens = z.strictObject({ team: Id });
export const PathLens = z.strictObject({ path: PathSelector });

/** Presentation-only highlighting a Saved View opens with; it never changes which nodes the View holds. */
export const Lens = z.union([ImpactLens, TeamLens, PathLens]);

/** The schema a Lens as written is checked against, picked by its keys. */
export function lensSchemaFor(value: unknown): z.ZodType | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  if ("impact" in value) return ImpactLens;
  if ("team" in value) return TeamLens;
  if ("path" in value) return PathLens;
  return undefined;
}

export const levels = ["c1", "c2", "c3", "deployment"] as const;

const viewFields = {
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  level: z.enum(levels),
  expand: z.array(Ref).optional().describe("Elements opened one level deeper than `level`"),
  collapse: z.array(Ref).optional().describe("Elements closed, hiding everything inside them"),
  direction: z.enum(["TB", "BT", "LR", "RL"]).optional(),
  environment: Id.optional().describe("For `level: deployment`: the Environment shown"),
  targets: z.array(Ref).optional().describe("For `level: deployment`: only these Deployment Target subtrees"),
};

/**
 * A Saved structural or Deployment View: `include` selectors (every Element
 * when absent) less `exclude`, collapsed to `level`, then `expand` and
 * `collapse` applied. A Deployment View also names its `environment`.
 */
export const StructuralView = z.strictObject({
  ...viewFields,
  include: z.array(Selector).optional().describe("Selectors to show; every Element when absent"),
  exclude: z.array(Selector).optional(),
  lens: Lens.optional(),
});

/** Shallow form used by Load: selectors and the Lens are checked one by one against the form each is written in. */
export const shallowView = z.strictObject({
  ...viewFields,
  include: z.array(z.unknown()).optional(),
  exclude: z.array(z.unknown()).optional(),
  lens: z.unknown().optional(),
});

/**
 * One interaction of a Dynamic View: `from` reaching `to` over a Relationship
 * between them (or a derived edge), an event `from` a publisher `to` one of its
 * subscribers, or with `return: true` the reply to a sync Relationship the
 * other way.
 */
export const Step = z.strictObject({
  from: Ref,
  to: Ref,
  relationship: Ref.optional().describe("The id of the Relationship the Step takes, when several connect the pair"),
  description: z.string().optional(),
  note: z.string().optional(),
  return: z.boolean().optional().describe("The reply to a sync Relationship from `to` to `from`"),
});

/** A Saved Dynamic View: one scenario as an ordered list of Steps, each resolved to an existing Relationship. */
export const DynamicView = z.strictObject({
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  participants: z.array(Ref).optional().describe("Fixes the participants' order; otherwise they are ordered by first appearance"),
  steps: z.array(Step),
});

export const Views = z.strictObject({
  structural: z.record(Id, StructuralView).optional(),
  dynamic: z.record(Id, DynamicView).optional(),
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
  views: Views.optional(),
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
    views: z.strictObject({ structural: children, dynamic: children }).optional(),
  }),
  view: shallowView,
  dynamicView: DynamicView,
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
export type RelationshipInput = z.infer<typeof Relationship>;
export type ServiceInput = z.infer<typeof Service>;
export type ModelFileInput = z.infer<typeof ModelFile>;
export type StructuralViewInput = z.infer<typeof StructuralView>;
export type DynamicViewInput = z.infer<typeof DynamicView>;
export type SelectorInput = z.infer<typeof Selector>;
export type LensInput = z.infer<typeof Lens>;
