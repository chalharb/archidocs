import { z } from "zod";

/** An author-chosen slug: Team, Environment, Project and Element ids. */
export const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug (a-z, 0-9 and -)");

/*
 * Every field below carries a description: editors show it on hover, and the
 * Model YAML reference prints it. A description that ends in a `Default: ….`
 * sentence fills the reference's Default column. A shape used in several
 * places has an `id`, so its JSON Schema is written once, under `$defs`.
 */

export const Link = z
  .strictObject({
    label: z.string().describe("The text of the link, such as `Runbook`."),
    url: z.url().describe("The page the link opens. A full URL, such as `https://wiki.example.com/runbooks/web`."),
  })
  .meta({ id: "Link", title: "Link", description: "A link to a page about the thing it is declared on, such as a runbook or a dashboard." });

export const Team = z
  .strictObject({
    name: z.string().describe("The Team's display name."),
    description: z.string().optional().describe("A short description of the Team."),
    links: z.array(Link).optional().describe("Links to pages about the Team."),
  })
  .describe("A Team: a group that can own Elements and Deployment Targets. Its key is the Team's id.");

export const Environment = z
  .strictObject({
    name: z.string().describe("The Environment's display name, such as `Production`."),
    description: z.string().optional().describe("A short description of the Environment."),
  })
  .describe("An Environment: a named stage that Services run in, such as prod or staging. Its key is the Environment's id.");

/** `workspace.yaml`: the only place Teams and Environments are defined. */
export const WorkspaceFile = z
  .strictObject({
    teams: z.record(Id, Team).optional().describe("The Teams of the Workspace, keyed by id. Every `owner` in every Project names one of these ids."),
    environments: z.record(Id, Environment).optional().describe("The Environments of the Workspace, keyed by id. Every Deployment in every Project names one of these ids."),
  })
  .describe("`workspace.yaml`: the Teams and Environments that every Project in the Workspace shares.");

/** `project.yaml`: marks a folder as a Project. */
export const ProjectFile = z
  .strictObject({
    id: Id.describe("The Project's id, unique in the Workspace. Other Projects write it as the prefix of a Qualified id, such as `payments:ledger`."),
    name: z.string().describe("The Project's display name."),
    owner: Id.describe("The Team that owns the Project: the id of a Team in `workspace.yaml`. It is the Owner of every Element and Deployment Target in the Project that sets no `owner` of its own."),
  })
  .describe("`project.yaml`: marks its folder as a Project.");

/** A reference to an Element or Deployment Target: a bare id in its own Project, or `project:id`. */
export const Ref = z
  .string()
  .regex(/^([a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9-]*$/, "must be an id, or `project:id` for one in another Project")
  .describe("An id in this Project, or `project:id` for one in another Project.");

/**
 * A dependency of the Element it is declared under (the consumer) on the
 * Element `to` names (the provider). An async one may run through a broker
 * Service (`via`) on a topic or queue (`channel`).
 */
export const Relationship = z
  .strictObject({
    to: Ref.describe(
      "The provider: the Element this one depends on. An id in this Project, or `project:id` for an Element in another Project. It can't be a Person, this Element itself, or an ancestor or descendant of this Element.",
    ),
    id: Id.optional().describe("An id for the Relationship, unique among the Project's Relationships. Needed only when several Relationships connect the same two Elements, so that a Dynamic View Step can name one."),
    description: z.string().optional().describe("What the consumer uses the provider for, as a verb phrase that reads from consumer to provider, such as `Reads prices from`."),
    technology: z.string().optional().describe("How the consumer reaches the provider: a protocol, a driver or a format, such as `JSON/HTTPS`, `gRPC` or `SQL`."),
    interaction: z
      .enum(["sync", "async"])
      .optional()
      .describe("`sync`: a call that waits for an answer. `async`: an event or message that gets no reply, such as an event through a broker or a webhook. Default: `sync`."),
    via: Ref.optional().describe(
      "For an `async` Relationship only: the broker the events travel through. A Service with `type: broker`, as an id in this Project or `project:id`. Leave it out when there is no broker, as with a webhook.",
    ),
    channel: z.string().optional().describe("For an `async` Relationship only: the topic or queue the events travel on, such as `orders.placed`."),
    tags: z.array(z.string()).optional().describe("Free-form labels for the Relationship."),
  })
  .meta({
    id: "Relationship",
    title: "Relationship",
    description: "A Relationship: a dependency of the Element it is declared under (the consumer) on the Element `to` names (the provider). Declare it once, under the consumer.",
  });

/** An Element's free-form facts: what a team wants to record that the Model has no field for. */
export const Metadata = z
  .record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()]))
  .describe(
    "Free-form facts about the Element that the Model has no field for, such as `tier: 1` or `on-call: payments-oncall`. Keys are labels, shown as written; values are strings, numbers or booleans. Nothing in the Model reads them: they are shown in the viewer and returned by the MCP server.",
  );

/** A link to the source code repository of a System, Service or Component. */
const Repository = z.url().describe("The full URL of the source code repository the Element is built from. Shown as a link in the viewer.");

/** The fields every kind of Element takes. */
const elementFields = {
  name: z.string().describe("The Element's display name."),
  description: z.string().optional().describe("What the Element is or does, in a sentence or two."),
  owner: Id.optional().describe(
    "The Team that owns the Element: the id of a Team in `workspace.yaml`. Set it only when it differs from the Project's; nothing is inherited from the parent Element. Default: the Project's `owner`.",
  ),
  tags: z.array(z.string()).optional().describe("Free-form labels. A Saved View's `{tag}` selector picks Elements by them."),
  links: z.array(Link).optional().describe("Links to pages about the Element, such as a runbook or a dashboard."),
  metadata: Metadata.optional(),
  relationships: z.array(Relationship).optional().describe("The Relationships this Element is the consumer of: what it depends on. A Relationship is never declared under its provider."),
};

export const Person = z.strictObject({ ...elementFields }).meta({
  id: "Person",
  title: "Person",
  description: "A Person: a human or role that uses a System, such as a shopper or a support agent. A Person is only ever the consumer in a Relationship.",
});

export const Component = z
  .strictObject({
    ...elementFields,
    technology: z.string().optional().describe("What the Component is built with, such as `TypeScript module`. Shown under its name."),
    repository: Repository.optional(),
    in: Id.optional().describe(
      "The Service this Component belongs to, as an id in this Project. Required for a Component under the top-level `components` key, and not allowed for one nested under a Service's `components`.",
    ),
  })
  .meta({ id: "Component", title: "Component", description: "A Component: a part inside a Service that is not deployed on its own." });

export const Service = z
  .strictObject({
    ...elementFields,
    type: z
      .enum(["app", "datastore", "broker"])
      .optional()
      .describe(
        "What the Service is; each type is drawn differently. `app`: an application, the usual case. `datastore`: a database or other store. `broker`: a message broker that async Relationships run through, named by their `via`. Default: `app`.",
      ),
    technology: z.string().optional().describe("What the Service is built with, such as `Go` or `PostgreSQL`. Shown under its name."),
    repository: Repository.optional(),
    external: z.boolean().optional().describe("`true` for a Service run outside the organization, such as a payment provider's API. An External Service can't declare Components. Default: `false`."),
    in: Id.optional().describe(
      "The System this Service belongs to, as an id in this Project. Only for a Service under the top-level `services` key, and not allowed for one nested under a System's `services`. Without it, a top-level Service stands outside any System.",
    ),
    components: z.record(Id, Component).optional().describe("The Components inside the Service, keyed by id."),
  })
  .meta({ id: "Service", title: "Service", description: "A Service: a deployable, addressable unit of software; the thing that has a URL and a Deployment." });

export const System = z
  .strictObject({
    ...elementFields,
    external: z.boolean().optional().describe("`true` for a System run outside the organization, such as a payment provider. Nothing inside an External System can declare Components. Default: `false`."),
    repository: Repository.optional(),
    services: z.record(Id, Service).optional().describe("The Services in the System, keyed by id."),
  })
  .meta({ id: "System", title: "System", description: "A System: a named grouping of Services that together deliver a business capability. Systems do not nest." });

const targetFields = {
  name: z.string().describe("The Deployment Target's display name."),
  kind: z.string().describe("What the Deployment Target is, in a short word you choose, printed as written in its header: prefer short forms such as `region`, `az`, `vnet`, `snet`, `vm`, `aks`, `ns` or `asp` over long names like `availability-zone` or `subnet`."),
  description: z.string().optional().describe("What the Deployment Target is, in a sentence or two."),
  owner: Id.optional().describe("The Team that owns the Deployment Target: the id of a Team in `workspace.yaml`. Default: the Project's `owner`."),
  tags: z.array(z.string()).optional().describe("Free-form labels for the Deployment Target."),
  links: z.array(Link).optional().describe("Links to pages about the Deployment Target, such as a dashboard."),
};

/** A Deployment Target: where Services run. Targets nest to any depth and are not Elements. */
export const Target: z.ZodType<TargetInput> = z
  .strictObject({
    ...targetFields,
    get targets() {
      return z.record(Id, Target).optional().describe("The Deployment Targets inside this one, keyed by id, such as the clusters in a region.");
    },
  })
  .meta({
    id: "Target",
    title: "Deployment Target",
    description: "A Deployment Target: a place Services run, such as a region, a cluster in it or a platform. Deployment Targets nest to any depth and are not Elements.",
  });

export interface TargetInput {
  name: string;
  kind: string;
  description?: string;
  owner?: string;
  tags?: string[];
  links?: z.infer<typeof Link>[];
  targets?: Record<string, TargetInput>;
}

export const Endpoint = z
  .strictObject({
    name: z.string().describe("What the endpoint is, such as `health` or `admin`."),
    url: z.url().describe("The endpoint's address. A full URL."),
  })
  .describe("A further named URL of the Service in this Environment.");

const InstanceCount = z
  .number({ error: "must be a whole number of at least 1" })
  .int({ error: "must be a whole number of at least 1" })
  .min(1, { error: "must be a whole number of at least 1" });

/** How many interchangeable copies of a Deployment run: a fixed count, or an autoscale range. */
export const Instances = z
  .union(
    [
      InstanceCount.describe("A fixed number of instances, such as `3`."),
      z
        .strictObject({
          min: InstanceCount.describe("The fewest instances the autoscaler runs."),
          max: InstanceCount.describe("The most instances the autoscaler runs. At least `min`."),
        })
        .refine((r) => r.max >= r.min, { error: "`max` must be at least `min`", path: ["max"] })
        .describe("An autoscale range, such as `{ min: 2, max: 10 }`."),
    ],
    { error: "must be a whole number of at least 1, or `{ min, max }` for an autoscale range" },
  )
  .describe(
    "How many interchangeable copies of the Service run on this Deployment Target: a whole number for a fixed count, such as `3`, or `{ min, max }` for an autoscale range, such as `{ min: 2, max: 10 }`. Use it for identical workers on one Target, such as an App Service plan running N instances. When where each copy runs matters, such as one per availability zone or VM, declare separate Deployments on separate Targets instead. Default: 1.",
  );

/** One Service running in one Environment on one Deployment Target. */
export const Deployment = z
  .strictObject({
    service: Ref.describe("The Service that runs: an id in this Project, or `project:id`. It must name a Service, not a System or a Component."),
    environment: Id.describe("The Environment it runs in: the id of an Environment in `workspace.yaml`."),
    target: Ref.describe("The Deployment Target it runs on: an id in this Project, or `project:id` for one another Project declares."),
    url: z.url().optional().describe("The Service's main URL in this Environment. A full URL, such as `https://cart.example.com`."),
    endpoints: z.array(Endpoint).optional().describe("Further named URLs of the Service in this Environment, such as a health check or an admin console."),
    instances: Instances.optional(),
  })
  .describe("A Deployment: one Service running in one Environment on one Deployment Target. The three together name it, so the same three can appear only once.");

/** How far `upstream` or `downstream` reaches: a number of hops, or `all` for the full transitive closure. */
const Hops = z.union([z.number().int().min(0), z.literal("all")], { error: "must be a number of hops, or `all`" }).describe("A number of hops, or `all`.");

/** Which paths a path selector or Lens takes: the shortest, or every path of at most n hops. */
const Paths = z.union([z.literal("shortest"), z.number().int().min(1)], { error: "must be `shortest`, or a number of hops" }).describe("`shortest`, or n for every path of at most n hops. Default: `shortest`.");

/** `{element}`: an Element, optionally with its children or descendants, and what it reaches upstream or downstream. */
export const ElementSelector = z
  .strictObject({
    element: Ref.describe("The Element to start from: an id in this Project, or `project:id`."),
    with: z.enum(["children", "descendants"]).optional().describe("Also selects what is inside the Element. `children`: the Elements directly inside it. `descendants`: everything inside it, at any depth."),
    upstream: Hops.optional().describe("Also selects the Elements upstream of it, those that depend on it: a number of hops, or `all` for every one of them."),
    downstream: Hops.optional().describe("Also selects the Elements downstream of it, those it depends on: a number of hops, or `all` for every one of them."),
  })
  .describe("One Element, and optionally what is inside it and what is upstream or downstream of it.");

/** `{team}`: every Element the Team owns. */
export const TeamSelector = z.strictObject({ team: Id.describe("The Team: the id of a Team in `workspace.yaml`.") }).describe("Every Element a Team owns.");

/** `{tag}`: every Element carrying the tag. */
export const TagSelector = z.strictObject({ tag: z.string().describe("The tag, as written in the Elements' `tags`.") }).describe("Every Element that carries a tag.");

/** `{from, to}`: every Element on the paths between two Elements, as `find_paths` follows them. */
export const PathSelector = z
  .strictObject({
    from: Ref.describe("One end of the paths: an id in this Project, or `project:id`."),
    to: Ref.describe("The other end of the paths: an id in this Project, or `project:id`."),
    paths: Paths.optional().describe("Which paths to take. `shortest`: the shortest paths, however long. A number n: every path of at most n hops. Default: `shortest`."),
  })
  .meta({
    id: "PathSelector",
    title: "Path selector",
    description: "The paths between two Elements, followed in both directions. As a selector it picks every Element on them; as a Lens it highlights them.",
  });

/** One entry of a Saved View's `include` or `exclude`: a bare id is the Element itself. */
export const Selector = z
  .union([Ref.describe("One Element, by its id: an id in this Project, or `project:id`."), ElementSelector, TeamSelector, TagSelector, PathSelector])
  .meta({ id: "Selector", title: "Selector", description: "One entry of a Saved View's `include` or `exclude`: an id, or a map that picks several Elements at once." });

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

export const ImpactLens = z
  .strictObject({
    impact: Ref.describe("The Element whose impact is highlighted: an id in this Project, or `project:id`."),
    direction: z
      .enum(["upstream", "downstream", "both"])
      .optional()
      .describe("Which side to highlight. `upstream`: what depends on the Element. `downstream`: what it depends on. `both`: both sides. Default: `both`."),
  })
  .describe("The Impact Lens: what is upstream or downstream of one Element, each node marked with how many hops away it is.");
export const TeamLens = z.strictObject({ team: Id.describe("The Team: the id of a Team in `workspace.yaml`.") }).describe("The Team Lens: what one Team owns.");
export const PathLens = z.strictObject({ path: PathSelector }).describe("The Path Lens: the paths between two Elements.");

/** Presentation-only highlighting a Saved View opens with; it never changes which nodes the View holds. */
export const Lens = z
  .union([ImpactLens, TeamLens, PathLens])
  .meta({ id: "Lens", title: "Lens", description: "The Lens the View opens with. A Lens highlights nodes and never changes which nodes the View shows." });

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
  title: z.string().describe("The View's display title."),
  description: z.string().optional().describe("What the View shows, or the question it answers."),
  tags: z.array(z.string()).optional().describe("Free-form labels for the View."),
  level: z
    .enum(levels)
    .describe(
      "The level every selected Element is collapsed to. `c1`: Persons and Systems. `c2`: Services, grouped in their Systems. `c3`: Components, inside their Services. `deployment`: a Deployment View, which places Deployments on their Deployment Targets in one Environment and needs `environment`.",
    ),
  expand: z
    .array(Ref)
    .optional()
    .describe("Elements to open one level deeper than `level`, showing their children. Each is an id in this Project, or `project:id`, and must be a node of the View that has children. A Deployment View ignores it."),
  collapse: z
    .array(Ref)
    .optional()
    .describe("Elements to close, hiding everything inside them. Each is an id in this Project, or `project:id`, and must be a node of the View that has children. A Deployment View ignores it."),
  direction: z
    .enum(["TB", "BT", "LR", "RL"])
    .optional()
    .describe("The way the diagram runs. `TB`: top to bottom. `BT`: bottom to top. `LR`: left to right. `RL`: right to left. Default: `LR`, or `TB` for a Deployment View."),
  environment: Id.optional().describe("For a Deployment View (`level: deployment`), which must have it, and for no other View: the Environment shown, as the id of an Environment in `workspace.yaml`."),
  targets: z
    .array(Ref)
    .optional()
    .describe(
      "For a Deployment View (`level: deployment`) only: shows only the Deployments on these Deployment Targets and on the Targets inside them. Each is an id in this Project, or `project:id`. Default: every Deployment Target.",
    ),
};

/**
 * A Saved structural or Deployment View: `include` selectors (every Element
 * when absent) less `exclude`, collapsed to `level`, then `expand` and
 * `collapse` applied. A Deployment View also names its `environment`.
 */
export const StructuralView = z
  .strictObject({
    ...viewFields,
    include: z.array(Selector).optional().describe("Selectors for the Elements to show. Default: every Element in the Workspace."),
    exclude: z.array(Selector).optional().describe("Selectors for the Elements to leave out of what `include` picked. An excluded Element takes everything inside it with it."),
    lens: Lens.optional(),
  })
  .describe("A structural Saved View: the Elements its selectors pick, drawn at one `level`. With `level: deployment` it is a Deployment View. Its key is the View's id, unique among the Project's Saved Views.");

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
export const Step = z
  .strictObject({
    from: Ref.describe("The Element the Step starts at: the consumer of a call, the Publisher of an event, or the sender of a reply. An id in this Project, or `project:id`."),
    to: Ref.describe("The Element the Step reaches: the provider of a call, the Subscriber of an event, or the receiver of a reply. An id in this Project, or `project:id`."),
    relationship: Ref.optional().describe("The `id` of the Relationship the Step takes, as an id in this Project or `project:id`. Needed only when several Relationships match the two Elements."),
    description: z.string().optional().describe("The text on the Step's arrow. Default: the Relationship's `description`, or its `channel` for an event."),
    note: z.string().optional().describe("A note shown under the Step."),
    return: z.boolean().optional().describe("`true` makes the Step the reply to a sync Relationship declared from `to` to `from`. An async Relationship has no reply. Default: `false`."),
  })
  .describe("A Step: one interaction of the scenario, which must follow a Relationship in the Model. It is a call from a consumer to its provider, an event from a Publisher to a Subscriber, or with `return: true` a reply.");

/** A Saved Dynamic View: one scenario as an ordered list of Steps, each resolved to an existing Relationship. */
export const DynamicView = z
  .strictObject({
    title: z.string().describe("The View's display title."),
    description: z.string().optional().describe("What the scenario is."),
    tags: z.array(z.string()).optional().describe("Free-form labels for the View."),
    participants: z
      .array(Ref)
      .optional()
      .describe(
        "Elements that take part, in the order to draw them, each as an id in this Project or `project:id`. Participants not listed follow, in the order the Steps first use them. An Element and its own ancestor can't both take part. Default: the order the Steps first use them.",
      ),
    steps: z.array(Step).describe("The Steps of the scenario, in order."),
  })
  .describe("A Dynamic View: one scenario as an ordered list of Steps, shown as a sequence chart. Its key is the View's id, unique among the Project's Saved Views.");

export const Views = z
  .strictObject({
    structural: z.record(Id, StructuralView).optional().describe("Structural Views and Deployment Views, keyed by id. Other Projects name a View as `project:id`."),
    dynamic: z.record(Id, DynamicView).optional().describe("Dynamic Views, keyed by id. Other Projects name a View as `project:id`."),
  })
  .describe("The Project's Saved Views: `structural` ones, which include Deployment Views, and `dynamic` ones.");

/**
 * Any other `*.yaml` in a Project: `people`, `systems > services > components`,
 * and top-level `services` and `components` (which attach with `in:`).
 * This full, nested form is what editors validate against.
 */
export const ModelFile = z
  .strictObject({
    people: z.record(Id, Person).optional().describe("Persons, keyed by id. An id is unique in the Project across all its Elements and Deployment Targets."),
    systems: z.record(Id, System).optional().describe("Systems, keyed by id, each with its Services nested under `services`."),
    services: z.record(Id, Service).optional().describe("Services declared at the top level, keyed by id: those outside any System, and those that join a System with `in`."),
    components: z.record(Id, Component).optional().describe("Components declared at the top level, keyed by id. Each names its Service with `in`."),
    targets: z.record(Id, Target).optional().describe("Deployment Targets, keyed by id and nested as they nest. Their ids share the Project's ids with its Elements."),
    deployments: z.array(Deployment).optional().describe("Deployments: which Service runs in which Environment on which Deployment Target, with its URLs."),
    views: Views.optional(),
  })
  .describe("A Project file: any `.yaml` file in a Project folder other than `project.yaml`.");

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
