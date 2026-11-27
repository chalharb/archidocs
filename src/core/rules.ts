import type { Bundle } from "../schema/bundle.ts";
import type { Files } from "./files.ts";
import { checkView, generatedViews, MAX_VIEW_NODES, parseViewId, type DynamicProblem, type DynamicResolution, type SavedResolution } from "./views/index.ts";
import { Id, parentKindOf, type ElementKind } from "../schema/workspace.ts";
import type { ElementDecl, Finding, IssueDraft, LoadedWorkspace, Project, RelationshipDecl, Severity, SourceFile, TargetDecl, ViewDecl } from "./model.ts";
import { qualified, qualify, referenceResolver, type Resolved } from "./refs.ts";
import type { BundleDynamicView, BundleStructuralView } from "../schema/bundle.ts";
import { didYouMean } from "./suggest.ts";
import type { AdrDecl } from "./model.ts";
import { AdrFrontmatter } from "../schema/adr.ts";
import { checkSchema } from "./schema-check.ts";
import { qualifyAdr } from "./adr.ts";

/** The part of the Model a rule is about, in the order the docs list them. Every rule is in exactly one. */
export const ruleAreas = ["workspace", "elements", "relationships", "deployments", "views", "decisions"] as const;
export type RuleArea = (typeof ruleAreas)[number];

/**
 * A check rule. Its examples are small Workspaces (paths relative to the
 * Workspace root): `failing` triggers the rule, `passing` is the same
 * Workspace with the fix applied and has no issues at all.
 */
export interface RuleDefinition {
  id: string;
  severity: Severity;
  area: RuleArea;
  /** The release that first shipped the rule, such as `"1.0.0"`. */
  since: `${number}.${number}.${number}`;
  summary: string;
  /** What goes wrong for a reader of the Model without the rule, in one or two sentences. */
  why: string;
  fix: string;
  /** Other rules worth reading with this one, by id. */
  related?: readonly string[];
  example: { failing: Files; passing: Files };
  /** `bundle` is the Bundle built from the same Workspace, for rules about what it resolves to. */
  check(workspace: LoadedWorkspace, bundle: Bundle): IssueDraft[];
}

const base: Files = {
  "workspace.yaml": "teams:\n  core:\n    name: Core\nenvironments:\n  prod:\n    name: Production\n",
  "shop/project.yaml": "id: shop\nname: Shop\nowner: core\n",
};

const withServices = (yaml: string, extra: Files = {}): Files => ({
  ...base,
  "shop/services.yaml": yaml,
  ...extra,
});

/** A Service, a Target it can run on, and `deployments` (a YAML list) in one Project file. */
const withDeployments = (deployments: string, extra: Files = {}): Files =>
  withServices(`services:\n  web:\n    name: Web\n  checkout:\n    name: Checkout\n    components:\n      cart:\n        name: Cart\ntargets:\n  eks-prod:\n    name: EKS prod\n    kind: cluster\ndeployments:\n${deployments}`, extra);

const findings = (rule: Finding["rule"]) => (ws: LoadedWorkspace) =>
  ws.files.flatMap((file) =>
    file.findings.filter((f) => f.rule === rule).map((f) => ({ file: file.path, line: f.line, column: f.column, message: f.message })),
  );

const at = (file: SourceFile, path: readonly (string | number)[], message: string, key = false): IssueDraft => {
  const pos = file.parsed.positionOf(path, { key });
  return { file: file.path, line: pos.line, column: pos.column, message };
};

const kindName: Record<ElementKind, string> = { person: "Person", system: "System", service: "Service", component: "Component" };
const named = (e: ElementDecl) => `${kindName[e.kind]} "${e.id}"`;

/** Where each kind belongs, said when it is nested somewhere it can't be. */
const belongs: Record<ElementKind, string> = {
  person: "a Person is declared only at the top level, under `people`",
  system: "Systems don't nest; declare it at the top level, under `systems`",
  service: "a Service goes inside a System, or at the top level",
  component: "a Component goes inside a Service",
};

/** The qualified ids of declarations in Projects that have a usable id. */
const qualifiedIds = (decls: readonly { id: string; project: Project }[]) =>
  new Set(decls.filter((d) => d.project.id !== undefined && !d.project.duplicateOf).map((d) => `${d.project.id}:${d.id}`));

/** "Unknown <what> "id" in Project "p"", suggesting the nearest id declared in that Project. */
const unknownIn = (what: string, qualified: string, decls: readonly { id: string; project: Project }[]) => {
  const [project, id] = qualified.split(":") as [string, string];
  const ids = decls.filter((d) => d.project.id === project && !d.project.duplicateOf).map((d) => d.id);
  return `Unknown ${what} "${id}" in Project "${project}"${didYouMean(id, ids)}`;
};

/** The `in:` an Element names, if it is a usable id. */
const inRef = (e: ElementDecl): string | undefined => (Id.safeParse(e.data.in).success ? (e.data.in as string) : undefined);

/** A second Project for examples that reference across Projects. */
const payments: Files = {
  "payments/project.yaml": "id: payments\nname: Payments\nowner: core\n",
  "payments/services.yaml": "services:\n  payments-api:\n    name: Payments API\n",
};

/** A Service with one Relationship, given as the YAML lines under `- `. */
const relating = (fields: string, extra = "") =>
  withServices(`services:\n  web:\n    name: Web\n    relationships:\n      - ${fields.split("\n").join("\n        ")}\n${extra}`);

const cart = "  cart:\n    name: Cart\n";
const events = (type: string) => `  events:\n    name: Events\n    type: ${type}\n`;

/** Two Relationships from `web` to `cart`, with the given ids. */
const twoToCart = (first: string, second: string) =>
  withServices(
    `services:\n  web:\n    name: Web\n    relationships:\n      - id: ${first}\n        to: cart\n      - id: ${second}\n        to: cart\n        description: Adds a gift card\n${cart}`,
  );

/** The Element references a Relationship makes: `to`, and `via` if given. */
const refsOf = (r: RelationshipDecl) => (["to", "via"] as const).filter((field) => r.data[field] !== undefined).map((field) => ({ field, ref: r.data[field] }));

/** Each Relationship reference with what it resolves to. */
const resolvedRefs = (ws: LoadedWorkspace) => {
  const resolve = referenceResolver(ws);
  return ws.relationships.flatMap((r) => refsOf(r).map(({ field, ref }) => ({ r, field, ref: ref as string, resolved: resolve(ref, r.from.project) })));
};

/** The provider a Relationship's `to` resolves to, if it does. */
const providers = (ws: LoadedWorkspace) =>
  resolvedRefs(ws).flatMap(({ r, field, resolved }) => (field === "to" && resolved.ok ? [{ r, to: resolved.element }] : []));

const ancestors = (e: ElementDecl): ElementDecl[] => {
  const seen: ElementDecl[] = [];
  for (let p = e.parent; p && !seen.includes(p); p = p.parent) seen.push(p);
  return seen;
};

const isSync = (r: RelationshipDecl) => r.data.interaction !== "async";

const asRecord = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** A value written at `path` (relative to the View) in a Saved View. */
type ViewValue = { path: (string | number)[]; value: unknown };

/** The Element references a Saved View makes: bare-id and `{element}` and path selectors, `expand`, `collapse` and the Lens; a Dynamic View's `participants` and Step ends. */
function viewElementRefs(v: ViewDecl): ViewValue[] {
  const out: ViewValue[] = [];
  for (const key of ["include", "exclude"] as const) {
    asList(v.data[key]).forEach((s, i) => {
      if (typeof s === "string") out.push({ path: [key, i], value: s });
      else for (const field of ["element", "from", "to"]) if (field in asRecord(s)) out.push({ path: [key, i, field], value: asRecord(s)[field] });
    });
  }
  for (const key of ["expand", "collapse", "participants"] as const) asList(v.data[key]).forEach((id, i) => out.push({ path: [key, i], value: id }));
  asList(v.data.steps).forEach((step, i) => {
    for (const end of ["from", "to"]) if (end in asRecord(step)) out.push({ path: ["steps", i, end], value: asRecord(step)[end] });
  });
  const lens = asRecord(v.data.lens);
  if ("impact" in lens) out.push({ path: ["lens", "impact"], value: lens.impact });
  const path = asRecord(lens.path);
  for (const field of ["from", "to"]) if (field in path) out.push({ path: ["lens", "path", field], value: path[field] });
  return out;
}

/** The Team references a Saved View makes: `{team}` selectors and a Team Lens. */
function viewTeamRefs(v: ViewDecl): ViewValue[] {
  const out: ViewValue[] = [];
  for (const key of ["include", "exclude"] as const) asList(v.data[key]).forEach((s, i) => "team" in asRecord(s) && out.push({ path: [key, i, "team"], value: asRecord(s).team }));
  if ("team" in asRecord(v.data.lens)) out.push({ path: ["lens", "team"], value: asRecord(v.data.lens).team });
  return out;
}

/** An Element reference, from a Relationship or a Saved View, with what it resolves to. */
interface ElementRef {
  file: SourceFile;
  path: (string | number)[];
  /** The Project it is written in. */
  project: Project;
  ref: string;
  resolved: Resolved;
}

/** Every Element reference made by a Relationship (`to`, `via`) or a Saved View. */
const elementRefs = (ws: LoadedWorkspace): ElementRef[] => {
  const resolve = referenceResolver(ws);
  return [
    ...resolvedRefs(ws).map(({ r, field, ref, resolved }) => ({ file: r.file, path: [...r.path, field], project: r.from.project, ref, resolved })),
    ...ws.views.flatMap((v) =>
      viewElementRefs(v).flatMap(({ path, value }) => (typeof value === "string" ? [{ file: v.file, path: [...v.path, ...path], project: v.project, ref: value, resolved: resolve(value, v.project) }] : [])),
    ),
  ];
};

/**
 * Each Saved View that made it into the Bundle (the first of a repeated id), with its definition and resolution;
 * a Deployment View with a missing or unknown Environment, which other rules report, isn't resolved.
 */
const resolvedSavedViews = (ws: LoadedWorkspace, bundle: Bundle): { decl: ViewDecl; def: BundleStructuralView; resolution: SavedResolution }[] =>
  ws.views.flatMap((decl) => {
    const def = bundledView(decl, bundle);
    if (def?.kind !== "structural") return [];
    if (def.level === "deployment" && !bundle.environments.some((e) => e.id === def.environment)) return [];
    return [{ decl, def, resolution: checkView(bundle, def) }];
  });

/** The Bundle definition a View declaration became, if it made it into the Bundle (the first of a repeated id). */
const bundledView = (decl: ViewDecl, bundle: Bundle) =>
  bundle.views.find((v) => v.id === `${decl.project.id}:${decl.id}` && v.source.file === decl.file.path && v.source.line === decl.line);

/** Each Dynamic View that made it into the Bundle, with its resolution. */
const resolvedDynamicViews = (ws: LoadedWorkspace, bundle: Bundle): { decl: ViewDecl; def: BundleDynamicView; resolution: DynamicResolution }[] =>
  ws.views.flatMap((decl) => {
    const def = bundledView(decl, bundle);
    return def?.kind === "dynamic" ? [{ decl, def, resolution: checkView(bundle, def) }] : [];
  });

/** A rule reporting one kind of Dynamic View problem, at the Step or participant it is about. */
const dynamicProblems = (rule: DynamicProblem["rule"]) => (ws: LoadedWorkspace, bundle: Bundle) =>
  resolvedDynamicViews(ws, bundle).flatMap(({ decl, resolution }) =>
    resolution.problems.filter((p) => p.rule === rule).map((p) => at(decl.file, [...decl.path, ...p.at], p.message)),
  );

const targetAncestry = (t: TargetDecl): TargetDecl[] => {
  const out = [t];
  for (let p = t.parent; p && !out.includes(p); p = p.parent) out.push(p);
  return out;
};

/**
 * A Dynamic View example: web calls cart; orders publishes `order-placed` on
 * the events broker, which mailer subscribes to. `views: dynamic:` is given
 * as the YAML under it, and `extra` adds fields to orders.
 */
const scenario = (views: string, extra = "") =>
  withServices(
    `services:\n  web:\n    name: Web\n    relationships:\n      - to: cart\n  cart:\n    name: Cart\n    components:\n      cart-api:\n        name: Cart API\n  orders:\n    name: Orders\n${extra}${events("broker")}  mailer:\n    name: Mailer\n    relationships:\n      - to: orders\n        interaction: async\n        via: events\n        channel: order-placed\nviews:\n  dynamic:\n${views.replace(/^/gm, "    ")}\n`,
  );

/** A Saved View example: two Services, one with a Component, and `views: structural:` given as the YAML under it. */
const viewing = (views: string, extra: Files = {}) =>
  withServices(
    `services:\n  web:\n    name: Web\n    relationships:\n      - to: cart\n  cart:\n    name: Cart\n    components:\n      cart-api:\n        name: Cart API\n  search:\n    name: Search\nviews:\n  structural:\n${views.replace(/^/gm, "    ")}\n`,
    extra,
  );


/** A position in an ADR's frontmatter, as an issue at its line in the file; line 1 when it has none. */
const atAdr = (adr: AdrDecl, path: readonly (string | number)[], message: string, key = false): IssueDraft => {
  if (!adr.frontmatter) return { file: adr.path, line: 1, message };
  const pos = adr.frontmatter.positionOf(path, { key });
  return { file: adr.path, line: pos.line + adr.lineOffset, column: pos.column, message };
};

/** An ADR file for examples: frontmatter lines, a `# ` title and a short body. */
const adrText = (frontmatter: string, title = "Use Kafka for events") => `---\n${frontmatter}\n---\n\n# ${title}\n\nWe publish domain events on Kafka.\n`;

/** An ADR example: one Service, a Saved View, and the given files under `shop/adr/`. */
const deciding = (adrs: Files): Files =>
  withServices(
    "services:\n  web:\n    name: Web\ntargets:\n  eks-prod:\n    name: EKS prod\n    kind: cluster\nviews:\n  structural:\n    front:\n      title: Front\n      level: c2\n",
    Object.fromEntries(Object.entries(adrs).map(([name, text]) => [`shop/adr/${name}`, text])),
  );

/** ADRs in a usable Project with an `NNNN` number, by qualified id (the first file of each number). */
const numberedAdrs = (ws: LoadedWorkspace) => {
  const byId = new Map<string, AdrDecl>();
  for (const a of ws.adrs) {
    if (a.project.id === undefined || a.project.duplicateOf || a.number === undefined) continue;
    const id = `${a.project.id}:${a.number}`;
    if (!byId.has(id)) byId.set(id, a);
  }
  return byId;
};

/** Each well-formed `supersedes` entry of a numbered ADR, qualified, with the ADR it names if any. */
const supersedesEntries = (ws: LoadedWorkspace) => {
  const adrs = numberedAdrs(ws);
  return [...adrs].flatMap(([id, a]) =>
    asList(a.data.supersedes).flatMap((ref, i) => {
      const to = qualifyAdr(ref, a.project);
      return to === undefined ? [] : [{ id, adr: a, index: i, to, target: adrs.get(to) }];
    }),
  );
};

export const rules: RuleDefinition[] = [
  {
    id: "yaml-syntax",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A file can't be parsed as YAML.",
    why: "Nothing in a file that can't be parsed reaches the Model. Everything it declares goes missing, and every reference to those ids fails as well.",
    fix: "Correct the YAML syntax at the reported position.",
    related: ["invalid-adr-frontmatter"],
    example: {
      failing: withServices("services:\n  web:\n    name: [Web\n"),
      passing: withServices("services:\n  web:\n    name: Web\n"),
    },
    check: (ws) =>
      ws.files.flatMap((file) => {
        const e = file.parsed.syntaxError;
        return e ? [{ file: file.path, line: e.line, column: e.column, message: e.message }] : [];
      }),
  },
  {
    id: "unknown-field",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A key isn't in the schema.",
    why: "A key the schema doesn't know is almost always a misspelling. If it were ignored, the Model would quietly lack what the author meant to declare, such as a Service's `technology`.",
    fix: "Remove the key, or correct its spelling to the suggested field.",
    related: ["missing-field", "invalid-value"],
    example: {
      failing: withServices("services:\n  web:\n    name: Web\n    techology: Go\n"),
      passing: withServices("services:\n  web:\n    name: Web\n    technology: Go\n"),
    },
    check: findings("unknown-field"),
  },
  {
    id: "missing-field",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A required field is absent.",
    why: "A required field is one the rest of the Model relies on, such as the `name` an Element is shown by or the `to` of a Relationship. Without it the declaration can't be drawn or resolved.",
    fix: "Add the missing field.",
    related: ["unknown-field", "invalid-value"],
    example: {
      failing: withServices("services:\n  web:\n    technology: Go\n"),
      passing: withServices("services:\n  web:\n    name: Web\n    technology: Go\n"),
    },
    check: findings("missing-field"),
  },
  {
    id: "invalid-value",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A value has the wrong type, a bad enum value or a malformed URL.",
    why: "A value a field doesn't accept means nothing to what reads the Model. A Service `type` outside `app`, `datastore` and `broker` can't be drawn, and a malformed `url` can't be opened.",
    fix: "Change the value to one the field accepts.",
    related: ["unknown-field", "missing-field"],
    example: {
      failing: withServices("services:\n  orders-db:\n    name: Orders DB\n    type: database\n"),
      passing: withServices("services:\n  orders-db:\n    name: Orders DB\n    type: datastore\n"),
    },
    check: findings("invalid-value"),
  },
  {
    id: "nested-project",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A `project.yaml` sits inside another Project's folder.",
    why: "A Project is one Team's folder: it namespaces the ids declared in it and gives them a default Owner. A Project inside another would put its files in two Teams' folders at once.",
    fix: "Move the inner Project's folder out of the outer Project's folder.",
    related: ["file-outside-project"],
    example: {
      failing: { ...base, "shop/legacy/project.yaml": "id: legacy\nname: Legacy\nowner: core\n" },
      passing: { ...base, "legacy/project.yaml": "id: legacy\nname: Legacy\nowner: core\n" },
    },
    check: (ws) =>
      ws.projects.flatMap((p) =>
        p.nestedIn
          ? [at(p.file, [], `Project folder ${p.folder} is inside Project "${p.nestedIn.id ?? p.nestedIn.folder}" (${p.nestedIn.folder}); Projects can't nest`)]
          : [],
      ),
  },
  {
    id: "file-outside-project",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A model file is under no Project.",
    why: "Elements, Deployments and Views always belong to a Project, which gives them their Qualified id and default Owner. A model file under no Project has neither, so nothing in it can join the Model.",
    fix: "Move the file into a Project folder (one with a `project.yaml`).",
    related: ["nested-project"],
    example: {
      failing: { ...base, "services.yaml": "services:\n  web:\n    name: Web\n" },
      passing: withServices("services:\n  web:\n    name: Web\n"),
    },
    check: (ws) =>
      ws.files
        .filter((f) => f.role === "outside")
        .map((f) => ({ file: f.path, line: 1, message: "File is in no Project; move it into a folder with a project.yaml" })),
  },
  {
    id: "duplicate-project-id",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "Two Projects share an id.",
    why: "A Qualified id, `project:id`, names one thing across the whole Workspace. If two Projects were both `shop`, `shop:web` could mean an Element in either.",
    fix: "Give one of the Projects a different id.",
    related: ["unknown-project", "duplicate-id"],
    example: {
      failing: { ...base, "shop-admin/project.yaml": "id: shop\nname: Shop admin\nowner: core\n" },
      passing: { ...base, "shop-admin/project.yaml": "id: shop-admin\nname: Shop admin\nowner: core\n" },
    },
    check: (ws) =>
      ws.projects.flatMap((p) =>
        p.duplicateOf ? [at(p.file, ["id"], `Project id "${p.id}" is already used by ${p.duplicateOf.file.path}`)] : [],
      ),
  },
  {
    id: "definition-outside-workspace",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "`teams` or `environments` declared outside `workspace.yaml`.",
    why: "Teams and Environments are defined once per Workspace, so `prod` means the same thing in every Project. A second definition inside a Project could disagree with the first.",
    fix: "Move the definitions into `workspace.yaml` at the Workspace root.",
    related: ["unknown-team", "unknown-environment"],
    example: {
      failing: withServices("teams:\n  web-team:\n    name: Web\n"),
      passing: {
        ...base,
        "workspace.yaml": "teams:\n  core:\n    name: Core\n  web-team:\n    name: Web\nenvironments:\n  prod:\n    name: Production\n",
      },
    },
    check: findings("definition-outside-workspace"),
  },
  {
    id: "unknown-team",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "An `owner`, or a Saved View's `{team}` selector or Team Lens, names no Team.",
    why: "Every Element has exactly one Owner, so there is one Team to ask when something breaks. An `owner` that names no Team leaves nobody accountable, and a `{team}` selector or Team Lens that names none shows nothing.",
    fix: "Use the id of a Team defined in `workspace.yaml`, or define the Team there.",
    related: ["definition-outside-workspace"],
    example: {
      failing: withServices("services:\n  web:\n    name: Web\n    owner: cor\n"),
      passing: withServices("services:\n  web:\n    name: Web\n    owner: core\n"),
    },
    check: (ws) => {
      const teams = new Set(ws.teams.map((t) => t.id));
      const message = (owner: string) => `Unknown Team "${owner}"${didYouMean(owner, teams)}`;
      // A malformed owner is already an `invalid-value`; report only that root cause.
      const unknown = (owner: unknown): owner is string => typeof owner === "string" && Id.safeParse(owner).success && !teams.has(owner);
      const issues: IssueDraft[] = [];
      for (const p of ws.projects) {
        if (unknown(p.owner)) issues.push(at(p.file, ["owner"], message(p.owner)));
      }
      for (const e of [...ws.elements, ...ws.targets]) {
        const owner = e.data.owner;
        if (unknown(owner)) issues.push(at(e.file, [...e.path, "owner"], message(owner)));
      }
      for (const v of ws.views) {
        for (const { path, value } of viewTeamRefs(v)) if (unknown(value)) issues.push(at(v.file, [...v.path, ...path], message(value)));
      }
      return issues;
    },
  },
  {
    id: "duplicate-id",
    severity: "error",
    area: "elements",
    since: "1.0.0",
    summary: "An Element or Deployment Target id is declared twice in a Project, across files too, whatever its kind or nesting.",
    why: "A reference such as `to: web` has to name one thing. Ids are unique across the whole Project, whatever the kind or nesting, so moving an Element under another parent never changes its id.",
    fix: "Rename one of the Elements or Targets, or remove the second declaration.",
    related: ["duplicate-relationship-id", "duplicate-view-id", "duplicate-project-id"],
    example: {
      failing: withServices("services:\n  web:\n    name: Web\n", { "shop/more.yaml": "services:\n  web:\n    name: Web v2\n" }),
      passing: withServices("services:\n  web:\n    name: Web\n", { "shop/more.yaml": "services:\n  web-v2:\n    name: Web v2\n" }),
    },
    check: (ws) => {
      const seen = new Map<string, { file: string; line: number }>();
      const issues: IssueDraft[] = [];
      // Elements and Targets share one namespace; the first in file order keeps the id.
      const decls = [...ws.elements, ...ws.targets].sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : a.line - b.line));
      for (const e of decls) {
        if (e.project.duplicateOf || e.project.id === undefined) continue;
        const key = `${e.project.id}:${e.id}`;
        const first = seen.get(key);
        if (first) {
          issues.push(at(e.file, e.path, `Id "${e.id}" is already declared in Project "${e.project.id}" at ${first.file}:${first.line}`, true));
        } else {
          seen.set(key, { file: e.file.path, line: e.line });
        }
      }
      return issues;
    },
  },
  {
    id: "invalid-nesting",
    severity: "error",
    area: "elements",
    since: "1.0.0",
    summary: "System > Service > Component is broken, by nesting or `in:`.",
    why: "Every View shows the Model at a level: Systems at C1, Services at C2, Components at C3. That depends on the nesting System > Service > Component: a Component directly inside a System has no Service to be drawn in.",
    fix: "Move the Element under a parent of the right kind (a Service under a System, a Component under a Service), or point `in:` at one.",
    related: ["external-with-components", "unknown-element"],
    example: {
      failing: withServices("systems:\n  checkout:\n    name: Checkout\n    components:\n      cart-api:\n        name: Cart API\n"),
      passing: withServices(
        "systems:\n  checkout:\n    name: Checkout\n    services:\n      cart:\n        name: Cart\n        components:\n          cart-api:\n            name: Cart API\n",
      ),
    },
    check: (ws) =>
      ws.elements.flatMap((e): IssueDraft[] => {
        const ref = inRef(e);
        if (e.nestedIn) {
          const issues: IssueDraft[] = [];
          if (parentKindOf[e.kind] !== e.nestedIn.kind) issues.push(at(e.file, e.path, `${named(e)} can't sit inside ${named(e.nestedIn)}; ${belongs[e.kind]}`, true));
          if (ref !== undefined) issues.push(at(e.file, [...e.path, "in"], `${named(e)} is nested under ${named(e.nestedIn)} and also names \`in: ${ref}\`; remove \`in:\``));
          return issues;
        }
        if (e.parent && parentKindOf[e.kind] !== e.parent.kind) {
          return [at(e.file, [...e.path, "in"], `${named(e)} can't sit inside ${named(e.parent)}; \`in:\` must name a ${kindName[parentKindOf[e.kind]!]}`)];
        }
        if (e.kind === "component" && ref === undefined) {
          return [at(e.file, e.path, `${named(e)} has no parent; nest it under a Service or add \`in: <service>\``, true)];
        }
        return [];
      }),
  },
  {
    id: "external-with-components",
    severity: "error",
    area: "elements",
    since: "1.0.0",
    summary: "An External System or Service declares Components.",
    why: "An External System or Service runs outside the organization, and you can't see inside it. Components declared there would describe software that its Owner, the Team accountable for the integration, doesn't run and can't check.",
    fix: "Remove the Components, or drop `external` if the organization runs the Element itself.",
    related: ["invalid-nesting"],
    example: {
      failing: withServices("services:\n  stripe:\n    name: Stripe\n    external: true\n    components:\n      stripe-sdk:\n        name: Stripe SDK\n"),
      passing: withServices("services:\n  stripe:\n    name: Stripe\n    external: true\n"),
    },
    check: (ws) =>
      ws.elements
        .filter((e) => e.kind === "component")
        .flatMap((e) => {
          const seen = new Set<ElementDecl>();
          for (let p = e.parent; p && !seen.has(p); p = p.parent) {
            seen.add(p);
            if (p.data.external === true && (p.kind === "service" || p.kind === "system")) {
              return [at(e.file, e.path, `${named(e)} is inside External ${named(p)}; an External Element can't contain declared Components`, true)];
            }
          }
          return [];
        }),
  },
  {
    id: "unknown-element",
    severity: "error",
    area: "elements",
    since: "1.0.0",
    summary: "A reference names no Element: in `to`, `via`, `in`, a Deployment's `service`, or a Saved View's selectors, `expand`, `collapse` or Lens.",
    why: "A reference that names no Element leaves something hanging: a Relationship with no provider, a Deployment with no Service, a Saved View that selects nothing. It is nearly always a misspelled id, so `check` suggests the nearest one.",
    fix: "Use the id of an Element declared in the Project, or declare it.",
    related: ["unknown-project", "wrong-kind", "unknown-target", "unknown-adr-link"],
    example: {
      failing: withServices("systems:\n  checkout:\n    name: Checkout\n", { "shop/cart.yaml": "services:\n  cart:\n    name: Cart\n    in: chekout\n" }),
      passing: withServices("systems:\n  checkout:\n    name: Checkout\n", { "shop/cart.yaml": "services:\n  cart:\n    name: Cart\n    in: checkout\n" }),
    },
    check: (ws) => {
      const projectName = (e: ElementDecl) => e.project.id ?? e.project.folder;
      const parents = ws.elements.flatMap((e) => {
        const ref = inRef(e);
        if (ref === undefined || e.nestedIn || e.parent) return [];
        const ids = ws.elements.filter((o) => o.project === e.project).map((o) => o.id);
        return [at(e.file, [...e.path, "in"], `Unknown Element "${ref}" in Project "${projectName(e)}"${didYouMean(ref, ids)}`)];
      });
      const references = elementRefs(ws).flatMap(({ file, path, project, resolved }) => {
        if (resolved.ok || resolved.reason !== "unknown-element") return [];
        const own = resolved.project === project;
        const ids = ws.elements.filter((o) => o.project === resolved.project).map((o) => (own ? o.id : qualified(o)));
        const input = own ? resolved.id : `${resolved.project.id}:${resolved.id}`;
        return [at(file, path, `Unknown Element "${resolved.id}" in Project "${resolved.project.id}"${didYouMean(input, ids)}`)];
      });
      const deployments = ws.deployments.flatMap((d) => {
        const ref = qualify(d.data.service, d.project);
        if (ref === undefined || d.service || qualifiedIds(ws.targets).has(ref)) return [];
        return [at(d.file, [...d.path, "service"], unknownIn("Element", ref, ws.elements))];
      });
      return [...parents, ...references, ...deployments];
    },
  },
  {
    id: "unknown-project",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A `project:` prefix names no Project.",
    why: "A Qualified id names its Project first. If no Project has that id, the reference points at nothing, and the Relationship or Saved View that makes it can't be resolved.",
    fix: "Correct the prefix to the id of an existing Project.",
    related: ["own-project-prefix", "unknown-element", "duplicate-project-id"],
    example: {
      failing: { ...relating("to: paymnts:payments-api"), ...payments },
      passing: { ...relating("to: payments:payments-api"), ...payments },
    },
    check: (ws) => {
      const projectIds = ws.projects.flatMap((p) => (p.id !== undefined && !p.duplicateOf ? [p.id] : []));
      const elementIds = ws.elements.filter((e) => e.project.id !== undefined && !e.project.duplicateOf).map(qualified);
      return elementRefs(ws).flatMap(({ file, path, ref, resolved }) => {
        if (resolved.ok || resolved.reason !== "unknown-project") return [];
        // The nearest qualified id names the Element meant; failing that, the nearest Project.
        const hint = didYouMean(ref, elementIds) || didYouMean(resolved.project, projectIds);
        return [at(file, path, `Unknown Project "${resolved.project}" in "${ref}"${hint}`)];
      });
    },
  },
  {
    id: "own-project-prefix",
    severity: "error",
    area: "workspace",
    since: "1.0.0",
    summary: "A Project qualifies its own ids.",
    why: "Every id has one spelling: bare inside its own Project, qualified from any other. If `cart` and `shop:cart` both worked inside `shop`, one Element would be written two ways in the same Project's files.",
    fix: "Drop the `project:` prefix; within its own Project an id is written bare.",
    related: ["unknown-project"],
    example: {
      failing: relating("to: shop:cart", cart),
      passing: relating("to: cart", cart),
    },
    check: (ws) =>
      elementRefs(ws).flatMap(({ file, path, project, ref, resolved }) =>
        resolved.ok && resolved.ownPrefix ? [at(file, path, `Write "${resolved.element.id}", not "${ref}", inside Project "${project.id}"`)] : [],
      ),
  },
  {
    id: "duplicate-relationship-id",
    severity: "error",
    area: "relationships",
    since: "1.0.0",
    summary: "A Relationship `id` repeats in a Project.",
    why: "A Relationship has an `id` so that a Dynamic View Step, or an agent, can say which of several Relationships between two Elements it means. Two Relationships with the same id can't be told apart.",
    fix: "Give one of the Relationships a different id.",
    related: ["ambiguous-step", "duplicate-id"],
    example: {
      failing: twoToCart("add-item", "add-item"),
      passing: twoToCart("add-item", "add-gift-card"),
    },
    check: (ws) => {
      const seen = new Map<string, RelationshipDecl>();
      return ws.relationships.flatMap((r) => {
        const id = r.data.id;
        if (typeof id !== "string" || r.from.project.id === undefined) return [];
        const key = `${r.from.project.id}:${id}`;
        const first = seen.get(key);
        if (!first) {
          seen.set(key, r);
          return [];
        }
        return [at(r.file, [...r.path, "id"], `Relationship id "${id}" is already used in Project "${r.from.project.id}" at ${first.file.path}:${first.line}`)];
      });
    },
  },
  {
    id: "self-relationship",
    severity: "error",
    area: "relationships",
    since: "1.0.0",
    summary: "An Element has a Relationship to itself.",
    why: "A Relationship says that one Element depends on another. Pointed at itself, an Element would be its own upstream and downstream, which tells a reader nothing; it is usually a `to` that names the wrong id.",
    fix: "Point `to` at the Element depended on, or remove the Relationship.",
    related: ["ancestor-descendant-relationship"],
    example: {
      failing: relating("to: web", cart),
      passing: relating("to: cart", cart),
    },
    check: (ws) =>
      providers(ws).flatMap(({ r, to }) => (to === r.from ? [at(r.file, [...r.path, "to"], `${named(r.from)} has a Relationship to itself`)] : [])),
  },
  {
    id: "person-as-provider",
    severity: "error",
    area: "relationships",
    since: "1.0.0",
    summary: "The provider of a Relationship is a Person.",
    why: "A Relationship points from what depends to what is depended on, and a Person is only ever a consumer: it uses Systems, and nothing depends on it. Pointed at a Person, the Relationship runs backward, so impact answers upstream and downstream of it are wrong.",
    fix: "A Person is only ever a consumer: declare the Relationship under the Person, pointing at what it uses.",
    example: {
      failing: relating("to: shopper", "people:\n  shopper:\n    name: Shopper\n"),
      passing: withServices("services:\n  web:\n    name: Web\npeople:\n  shopper:\n    name: Shopper\n    relationships:\n      - to: web\n"),
    },
    check: (ws) =>
      providers(ws).flatMap(({ r, to }) =>
        to.kind === "person" ? [at(r.file, [...r.path, "to"], `${named(to)} can't be a provider; declare the Relationship under the Person instead`)] : [],
      ),
  },
  {
    id: "ancestor-descendant-relationship",
    severity: "error",
    area: "relationships",
    since: "1.0.0",
    summary: "An Element is linked to its own ancestor or descendant.",
    why: "A Component is part of its Service, and a Service part of its System; the nesting already says so. A Relationship between an Element and its own ancestor can't be drawn at the ancestor's level, where both ends are the same node.",
    fix: "Point `to` at an Element outside the consumer's own branch, such as a sibling.",
    related: ["self-relationship", "ancestor-descendant-participants"],
    example: {
      failing: withServices("services:\n  web:\n    name: Web\n    components:\n      web-ui:\n        name: Web UI\n        relationships:\n          - to: web\n"),
      passing: withServices(
        "services:\n  web:\n    name: Web\n    components:\n      web-ui:\n        name: Web UI\n        relationships:\n          - to: web-api\n      web-api:\n        name: Web API\n",
      ),
    },
    check: (ws) =>
      providers(ws).flatMap(({ r, to }) => {
        if (ancestors(r.from).includes(to)) return [at(r.file, [...r.path, "to"], `${named(r.from)} is inside ${named(to)}, so it can't have a Relationship to it`)];
        if (ancestors(to).includes(r.from)) return [at(r.file, [...r.path, "to"], `${named(to)} is inside ${named(r.from)}, so ${named(r.from)} can't have a Relationship to it`)];
        return [];
      }),
  },
  {
    id: "via-on-sync",
    severity: "error",
    area: "relationships",
    since: "1.0.0",
    summary: "`via` or `channel` on a sync Relationship.",
    why: "`via` and `channel` say which broker and channel carry a Publisher's events to a Subscriber. A sync Relationship is a call that waits for an answer, with no broker in it, so they would add a hop that isn't there to impact and path answers.",
    fix: "Set `interaction: async` if the Relationship runs through a broker, or remove `via` and `channel`.",
    related: ["via-not-broker", "return-on-async"],
    example: {
      failing: relating("to: cart\nvia: events\nchannel: cart.updated", `${cart}${events("broker")}`),
      passing: relating("to: cart\ninteraction: async\nvia: events\nchannel: cart.updated", `${cart}${events("broker")}`),
    },
    check: (ws) =>
      ws.relationships.filter(isSync).flatMap((r) =>
        (["via", "channel"] as const)
          .filter((field) => r.data[field] !== undefined)
          .map((field) => at(r.file, [...r.path, field], `\`${field}\` is only for an async Relationship; add \`interaction: async\` or remove \`${field}\``, true)),
      ),
  },
  {
    id: "via-not-broker",
    severity: "error",
    area: "relationships",
    since: "1.0.0",
    summary: "`via` names a Service that isn't `type: broker`.",
    why: "Impact and path answers count the `via` Service as a hop, and as something both sides depend on. That is true only of a broker: for any other Service it would claim that both sides depend on it when they don't.",
    fix: "Point `via` at a broker Service, or mark the Service `type: broker`.",
    related: ["via-on-sync", "wrong-kind"],
    example: {
      failing: relating("to: cart\ninteraction: async\nvia: events", `${cart}${events("app")}`),
      passing: relating("to: cart\ninteraction: async\nvia: events", `${cart}${events("broker")}`),
    },
    check: (ws) =>
      resolvedRefs(ws).flatMap(({ r, field, resolved }) => {
        if (field !== "via" || !resolved.ok || resolved.element.kind !== "service") return [];
        const type = resolved.element.data.type ?? "app";
        return type === "broker" ? [] : [at(r.file, [...r.path, field], `\`via\` must name a broker Service, but ${named(resolved.element)} has type "${String(type)}"`)];
      }),
  },
  {
    id: "duplicate-deployment",
    severity: "error",
    area: "deployments",
    since: "1.0.0",
    summary: "The same Service, Environment and Target appear twice.",
    why: "A Deployment is one Service in one Environment on one Deployment Target, and those three name it: it has no id of its own. A second one with the same three could carry a different `url`, with nothing to say which is right.",
    fix: "Remove the second Deployment, or merge its `url` and `endpoints` into the first.",
    example: {
      failing: withDeployments(
        "  - { service: web, environment: prod, target: eks-prod, url: https://shop.example.com }\n",
        { "shop/more.yaml": "deployments:\n  - { service: web, environment: prod, target: eks-prod, url: https://www.shop.example.com }\n" },
      ),
      passing: withDeployments("  - { service: web, environment: prod, target: eks-prod, url: https://shop.example.com }\n"),
    },
    check: (ws) => {
      const seen = new Map<string, { file: string; line: number }>();
      const issues: IssueDraft[] = [];
      for (const d of ws.deployments) {
        const service = qualify(d.data.service, d.project);
        const target = qualify(d.data.target, d.project);
        const environment = d.data.environment;
        if (service === undefined || target === undefined || typeof environment !== "string" || d.project.duplicateOf) continue;
        const key = `${service}\0${environment}\0${target}`;
        const first = seen.get(key);
        if (first) {
          issues.push({ file: d.file.path, line: d.line, column: d.column, message: `Service "${service}" is already deployed to "${target}" in Environment "${environment}" at ${first.file}:${first.line}` });
        } else {
          seen.set(key, { file: d.file.path, line: d.line });
        }
      }
      return issues;
    },
  },
  {
    id: "unknown-environment",
    severity: "error",
    area: "deployments",
    since: "1.0.0",
    summary: "A Deployment, or a Saved Deployment View, names no Environment.",
    why: "Environments are defined once, in `workspace.yaml`, so `prod` means the same thing in every Project. A Deployment that says `production` when the Environment is `prod` belongs to no Environment, and nobody asking where the Service runs in `prod` will find it.",
    fix: "Use the id of an Environment defined in `workspace.yaml`, or define the Environment there.",
    related: ["unknown-target", "target-outside-environment", "definition-outside-workspace"],
    example: {
      failing: withDeployments("  - { service: web, environment: production, target: eks-prod }\n"),
      passing: withDeployments("  - { service: web, environment: prod, target: eks-prod }\n"),
    },
    check: (ws) => {
      const environments = new Set(ws.environments.map((e) => e.id));
      return [...ws.deployments, ...ws.views].flatMap((d) => {
        const env = d.data.environment;
        // A malformed id is already an `invalid-value`.
        if (env === undefined || !Id.safeParse(env).success || environments.has(env as string)) return [];
        return [at(d.file, [...d.path, "environment"], `Unknown Environment "${env as string}"${didYouMean(env as string, environments)}`)];
      });
    },
  },
  {
    id: "unknown-target",
    severity: "error",
    area: "deployments",
    since: "1.0.0",
    summary: "A Deployment, or a Saved Deployment View's `targets`, names no Deployment Target.",
    why: "A Deployment says where a Service runs. If its `target` names no Deployment Target, the Deployment has nowhere to be placed in a Deployment View; a Saved Deployment View that names one narrows to a Target that doesn't exist.",
    fix: "Use the id of a Target declared in the Project, or `project:id` for one declared in another Project.",
    related: ["unknown-environment", "target-outside-environment", "wrong-kind"],
    example: {
      failing: withDeployments("  - { service: web, environment: prod, target: eks-prd }\n"),
      passing: withDeployments("  - { service: web, environment: prod, target: eks-prod }\n"),
    },
    check: (ws) => {
      const known = qualifiedIds(ws.targets);
      const deployments = ws.deployments.flatMap((d) => {
        const ref = qualify(d.data.target, d.project);
        if (ref === undefined || d.target) return [];
        return [at(d.file, [...d.path, "target"], unknownIn("Deployment Target", ref, ws.targets))];
      });
      const views = ws.views.flatMap((v) =>
        asList(v.data.targets).flatMap((target, i) => {
          const ref = qualify(target, v.project);
          return ref === undefined || known.has(ref) ? [] : [at(v.file, [...v.path, "targets", i], unknownIn("Deployment Target", ref, ws.targets))];
        }),
      );
      return [...deployments, ...views];
    },
  },
  {
    id: "wrong-kind",
    severity: "error",
    area: "elements",
    since: "1.0.0",
    summary: "An id resolves to a kind the field doesn't accept, such as a Deployment's `service` naming a Component or System, or a Relationship's `via` naming something other than a Service.",
    why: "Some fields take one kind only. Only a Service is deployed, because Systems and Components run as part of their Services, and only a Service can be the broker an async Relationship runs through.",
    fix: "Point the field at an id of the kind it accepts: a Deployment's `service` and a Relationship's `via` each name a Service.",
    related: ["unknown-element", "via-not-broker", "unknown-target"],
    example: {
      failing: withDeployments("  - { service: cart, environment: prod, target: eks-prod }\n"),
      passing: withDeployments("  - { service: web, environment: prod, target: eks-prod }\n"),
    },
    check: (ws) => {
      const targets = qualifiedIds(ws.targets);
      const deployments = ws.deployments.flatMap((d) => {
        const ref = qualify(d.data.service, d.project);
        if (ref === undefined) return [];
        const kind = d.service ? (d.service.kind === "service" ? undefined : kindName[d.service.kind]) : targets.has(ref) ? "Deployment Target" : undefined;
        return kind ? [at(d.file, [...d.path, "service"], `A Deployment's \`service\` must name a Service, but "${ref}" is a ${kind}`)] : [];
      });
      const vias = resolvedRefs(ws).flatMap(({ r, field, ref, resolved }) =>
        field === "via" && resolved.ok && resolved.element.kind !== "service"
          ? [at(r.file, [...r.path, field], `\`via\` must name a broker Service, but "${ref}" is a ${kindName[resolved.element.kind]}`)]
          : [],
      );
      return [...deployments, ...vias];
    },
  },
  {
    id: "oversized-view",
    severity: "warning",
    area: "views",
    since: "1.0.0",
    summary: `A View has more than ${MAX_VIEW_NODES} nodes, too many for a readable diagram. A Generated View is reported at its System or Service, or at \`workspace.yaml\` for the Landscapes; a Saved View at its id.`,
    why: `A View is a diagram for people to read. With more than ${MAX_VIEW_NODES} nodes the boxes and lines are too many to follow, so the View answers no question at a glance.`,
    fix: "Split the System, or group top-level Services and Systems, so each Generated View stays within the limit; narrow a Saved View's selectors or raise its `level`. The C2 Landscape opens every System, so it stays within the limit only while the Workspace's Systems, Services and Persons do.",
    related: ["empty-view"],
    example: {
      failing: withServices(`systems:\n  big:\n    name: Big\n    services:\n${numbered(MAX_VIEW_NODES, "s", 6)}`),
      passing: withServices(
        `systems:\n  big:\n    name: Big\n    services:\n${numbered(MAX_VIEW_NODES / 2 - 1, "s", 6)}  more:\n    name: More\n    services:\n${numbered(MAX_VIEW_NODES / 2 - 1, "s", 6, MAX_VIEW_NODES / 2)}`,
      ),
    },
    check: (ws, bundle) => {
      const workspaceFile = ws.files.find((f) => f.role === "workspace");
      const generated = generatedViews(bundle)
        .filter((v) => v.nodes.length > MAX_VIEW_NODES)
        .flatMap((v) => {
          const ref = parseViewId(v.id);
          const focus = ref?.form === "focused" ? bundle.elements.find((e) => e.id === ref.element) : undefined;
          const where = focus ? focus.source : workspaceFile ? { file: workspaceFile.path, line: 1 } : undefined;
          if (!where) return [];
          return [{ file: where.file, line: where.line, message: `Generated View "${v.id}" has ${v.nodes.length} nodes, more than the ${MAX_VIEW_NODES} a diagram stays readable at` }];
        });
      const saved = resolvedSavedViews(ws, bundle)
        .filter(({ resolution }) => resolution.view.nodes.length > MAX_VIEW_NODES)
        .map(({ decl, def, resolution }) => at(decl.file, decl.path, `Saved View "${def.id}" has ${resolution.view.nodes.length} nodes, more than the ${MAX_VIEW_NODES} a diagram stays readable at`, true));
      return [...generated, ...saved];
    },
  },
  {
    id: "duplicate-view-id",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "A Saved View id repeats in a Project, across files too.",
    why: "A Saved View is opened, exported and linked from ADRs by its Qualified id, such as `shop:front`. Only the first View with an id goes into the Workspace Bundle, so the second could never be opened.",
    fix: "Give one of the Views a different id.",
    related: ["duplicate-id"],
    example: {
      failing: viewing("front:\n  title: Front\n  level: c2", { "shop/more.yaml": "views:\n  structural:\n    front:\n      title: Front again\n      level: c2\n" }),
      passing: viewing("front:\n  title: Front\n  level: c2", { "shop/more.yaml": "views:\n  structural:\n    front-v2:\n      title: Front again\n      level: c2\n" }),
    },
    check: (ws) => {
      const seen = new Map<string, ViewDecl>();
      return ws.views.flatMap((v) => {
        if (v.project.id === undefined || v.project.duplicateOf) return [];
        const key = `${v.project.id}:${v.id}`;
        const first = seen.get(key);
        if (!first) {
          seen.set(key, v);
          return [];
        }
        return [at(v.file, v.path, `View id "${v.id}" is already used in Project "${v.project.id}" at ${first.file.path}:${first.line}`, true)];
      });
    },
  },
  {
    id: "missing-step",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "A Dynamic View Step has no Relationship or derived edge between `from` and `to` (nor a `via` subscription of `to` to `from`), or the named `relationship` doesn't connect them.",
    why: "Each Step must follow a Relationship that exists in the Model, so a scenario can't show a call the architecture doesn't have. A Step with no Relationship behind it means the scenario is wrong or the Model is missing a Relationship.",
    fix: "Point the Step at two Elements a Relationship connects, declare the Relationship, or name one that connects them.",
    related: ["ambiguous-step", "return-without-relationship"],
    example: {
      failing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: cart, to: web }"),
      passing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: web, to: cart }"),
    },
    check: dynamicProblems("missing-step"),
  },
  {
    id: "ambiguous-step",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "Several Relationships match a Dynamic View Step (several between the pair, or both a call and an event) and no `relationship` names one.",
    why: "A Step takes its kind, a call or an event, and its default label from the Relationship it follows. When several Relationships match, Archidocs doesn't guess which one the scenario means.",
    fix: "Name the Relationship the Step takes with `relationship: <id>`.",
    related: ["missing-step", "duplicate-relationship-id"],
    example: {
      failing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: orders, to: mailer }", "    relationships:\n      - id: notify\n        to: mailer\n"),
      passing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: orders, to: mailer, relationship: notify }", "    relationships:\n      - id: notify\n        to: mailer\n"),
    },
    check: dynamicProblems("ambiguous-step"),
  },
  {
    id: "return-without-relationship",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "A Dynamic View return Step has no Relationship the other way, from its `to` to its `from`.",
    why: "A return Step is the provider's reply to a consumer, so it follows a Relationship the other way round: from its `to` to its `from`. With no such Relationship there is no call for it to be the reply to.",
    fix: "Turn the Step round, or remove `return: true` if it is a call of its own.",
    related: ["return-on-async", "missing-step"],
    example: {
      failing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: web, to: cart, return: true }"),
      passing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: web, to: cart }\n    - { from: cart, to: web, return: true }"),
    },
    check: dynamicProblems("return-without-relationship"),
  },
  {
    id: "return-on-async",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "A Dynamic View return Step resolves to an async Relationship, which has no reply.",
    why: "An async Relationship doesn't wait for an answer, so there is no reply to draw. If the other side calls back later, that is a Relationship of its own and belongs in the Model.",
    fix: "Remove the return Step, or model the callback as a Relationship of its own and add a Step for it.",
    related: ["return-without-relationship", "via-on-sync"],
    example: {
      failing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: orders, to: mailer, return: true }"),
      passing: scenario("purchase:\n  title: Purchase\n  steps:\n    - { from: orders, to: mailer }"),
    },
    check: dynamicProblems("return-on-async"),
  },
  {
    id: "ancestor-descendant-participants",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "An Element and its own ancestor are both participants of a Dynamic View.",
    why: "A Dynamic View tells its scenario with each Element at one level. With a Service and one of its own Components both taking part, the same software appears twice in the sequence chart, and a reader can't tell which of the two a Step really reaches.",
    fix: "Tell the scenario at one level: use the ancestor throughout, or its descendants throughout.",
    related: ["ancestor-descendant-relationship", "missing-step"],
    example: {
      failing: scenario("purchase:\n  title: Purchase\n  participants: [cart]\n  steps:\n    - { from: web, to: cart-api }"),
      passing: scenario("purchase:\n  title: Purchase\n  participants: [cart]\n  steps:\n    - { from: web, to: cart }"),
    },
    check: dynamicProblems("ancestor-descendant-participants"),
  },
  {
    id: "target-outside-environment",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "A Saved Deployment View's `targets` entry has no Deployment in the View's `environment`, on it or on any Target inside it.",
    why: "A Deployment View shows one Environment. A Deployment Target with no Deployment in that Environment, on it or on any Target inside it, has nothing to show there; it usually means the wrong Target or the wrong Environment.",
    fix: "Remove the Target from `targets`, or point the View at the Environment that runs on it.",
    related: ["unknown-target", "unknown-environment", "empty-view"],
    example: {
      failing: withDeployments("  - { service: web, environment: prod, target: eks-prod }\n", {
        "shop/views.yaml": "targets:\n  eks-staging:\n    name: EKS staging\n    kind: cluster\nviews:\n  structural:\n    runtime:\n      title: Runtime\n      level: deployment\n      environment: prod\n      targets: [eks-staging]\n",
      }),
      passing: withDeployments("  - { service: web, environment: prod, target: eks-prod }\n", {
        "shop/views.yaml": "targets:\n  eks-staging:\n    name: EKS staging\n    kind: cluster\nviews:\n  structural:\n    runtime:\n      title: Runtime\n      level: deployment\n      environment: prod\n      targets: [eks-prod]\n",
      }),
    },
    check: (ws) => {
      const targets = new Map(ws.targets.filter((t) => t.project.id !== undefined).map((t) => [`${t.project.id}:${t.id}`, t]));
      return ws.views.flatMap((v) => {
        const env = v.data.environment;
        if (v.data.level !== "deployment" || typeof env !== "string" || !ws.environments.some((e) => e.id === env)) return [];
        return asList(v.data.targets).flatMap((ref, i) => {
          const id = qualify(ref, v.project);
          const target = id === undefined ? undefined : targets.get(id);
          if (!target) return [];
          const hosts = ws.deployments.some((d) => d.data.environment === env && d.target && targetAncestry(d.target).includes(target));
          return hosts ? [] : [at(v.file, [...v.path, "targets", i], `Deployment Target "${id}" has no Deployment in Environment "${env}"`)];
        });
      });
    },
  },
  {
    id: "bad-expand",
    severity: "error",
    area: "views",
    since: "1.0.0",
    summary: "A Saved View's `expand` or `collapse` id is not a node of the View once collapsed to its `level`, or has no children.",
    why: "`expand` and `collapse` open or close single Elements once the View is collapsed to its `level`. An id that isn't a node of the View, or has no children, can't be opened or closed, so the View doesn't show what its author meant.",
    fix: "Remove the id, include the Element in the View, or name an Element that has children.",
    related: ["unknown-element"],
    example: {
      failing: viewing("front:\n  title: Front\n  level: c2\n  include: [web]\n  expand: [web]"),
      passing: viewing("front:\n  title: Front\n  level: c2\n  include: [web, cart]\n  expand: [cart]"),
    },
    check: (ws, bundle) => {
      const known = new Set(bundle.elements.map((e) => e.id));
      return resolvedSavedViews(ws, bundle).flatMap(({ decl, resolution }) =>
        resolution.badExpand
          .filter((b) => known.has(b.id))
          .map((b) => at(decl.file, [...decl.path, b.field, b.index], `Can't ${b.field} "${b.id}": ${b.reason === "no-children" ? "it has no children" : "it is not in the View"}`)),
      );
    },
  },
  {
    id: "empty-view",
    severity: "warning",
    area: "views",
    since: "1.0.0",
    summary: "A Saved View resolves to no nodes.",
    why: "A Saved View that selects nothing draws an empty diagram, which answers no question. It usually means the selectors no longer match the Model.",
    fix: "Correct the selectors so they name Elements, or remove the View.",
    related: ["unresolved-path", "oversized-view"],
    example: {
      failing: viewing("front:\n  title: Front\n  level: c2\n  include: [{ tag: storefront }]"),
      passing: withServices("services:\n  web:\n    name: Web\n    tags: [storefront]\nviews:\n  structural:\n    front:\n      title: Front\n      level: c2\n      include: [{ tag: storefront }]\n"),
    },
    check: (ws, bundle) =>
      resolvedSavedViews(ws, bundle)
        .filter(({ resolution }) => resolution.view.nodes.length === 0)
        .map(({ decl, def }) => at(decl.file, decl.path, `Saved View "${def.id}" resolves to no nodes`, true)),
  },
  {
    id: "unresolved-path",
    severity: "warning",
    area: "views",
    since: "1.0.0",
    summary: "A Saved View's path selector, or path Lens, finds no path between its two Elements.",
    why: "A path selector or path Lens is there to show how one Element reaches another, and with no path between the two it adds nothing to the View. It is a warning, not an error, because a Model edit can legitimately break the path.",
    fix: "Check the Relationships between the two Elements, or raise `paths`; remove the selector if the path is gone for good.",
    related: ["empty-view"],
    example: {
      failing: viewing("front:\n  title: Front\n  level: c2\n  include: [{ from: web, to: search }]"),
      passing: viewing("front:\n  title: Front\n  level: c2\n  include: [{ from: web, to: cart }]"),
    },
    check: (ws, bundle) =>
      resolvedSavedViews(ws, bundle).flatMap(({ decl, resolution }) =>
        resolution.unresolvedPaths.map((u) => at(decl.file, [...decl.path, ...u.at], `No path between "${u.from}" and "${u.to}"`)),
      ),
  },
  {
    id: "invalid-adr-frontmatter",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "An ADR has no frontmatter, frontmatter that isn't valid YAML, or a field that is unknown, missing (`status`, `date`) or invalid, such as a `status` outside proposed, accepted, rejected, deprecated and superseded.",
    why: "The frontmatter ties an ADR to the Model: `status` says whether the decision stands, and `elements` and `views` say what it affects. If it can't be read, a Proposed decision can't be told from an accepted one, and the ADR can't be shown on the Elements it is about.",
    fix: "Start the file with `---`, `status` and `date` (YYYY-MM-DD), then `---`; use only the MADR fields and the `elements`, `views` and `supersedes` links.",
    related: ["missing-adr-title", "hand-written-superseded", "yaml-syntax"],
    example: {
      failing: deciding({ "0001-use-kafka.md": adrText("status: approved\ndate: 2026-03-01") }),
      passing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01") }),
    },
    check: (ws) =>
      ws.adrs.flatMap((a): IssueDraft[] => {
        if (!a.frontmatter) return [{ file: a.path, line: 1, message: "ADR has no frontmatter: start the file with `---`, then `status` and `date`, then `---`" }];
        const e = a.frontmatter.syntaxError;
        if (e) return [{ file: a.path, line: e.line + a.lineOffset, column: e.column, message: e.message }];
        return checkSchema(AdrFrontmatter, a.frontmatter.data, a.frontmatter).map((f) => ({ file: a.path, line: f.line + a.lineOffset, column: f.column, message: f.message }));
      }),
  },
  {
    id: "missing-adr-title",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "An ADR's body has no `# ` heading to take its title from.",
    why: "An ADR is listed by its title, in the viewer and in `list_adrs`. The title is the body's first `# ` heading, not a frontmatter field, so an ADR without one has no name to be listed by.",
    fix: "Start the body with a `# ` heading naming the decision.",
    related: ["invalid-adr-frontmatter", "bad-adr-filename"],
    example: {
      failing: deciding({ "0001-use-kafka.md": "---\nstatus: accepted\ndate: 2026-03-01\n---\n\nWe publish domain events on Kafka.\n" }),
      passing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01") }),
    },
    check: (ws) =>
      ws.adrs.flatMap((a) => (a.title || !a.frontmatter ? [] : [{ file: a.path, line: a.bodyLine, message: "ADR has no title: start the body with a `# ` heading" }])),
  },
  {
    id: "bad-adr-filename",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "A file in a Project's `adr/` folder isn't named `NNNN-slug.md` (and isn't `template.md`).",
    why: "An ADR's id is the number in its file name: `shop/adr/0003-use-kafka.md` is `shop:0003`. A file without the four-digit number has no id, so no `supersedes` can name it.",
    fix: "Rename it to the next free four-digit number and a lowercase slug, such as `0002-use-kafka.md`.",
    related: ["duplicate-adr-number"],
    example: {
      failing: deciding({ "use-kafka.md": adrText("status: accepted\ndate: 2026-03-01") }),
      passing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01") }),
    },
    check: (ws) => {
      const next = new Map<Project, number>();
      for (const a of ws.adrs) if (a.number !== undefined) next.set(a.project, Math.max(next.get(a.project) ?? 0, Number(a.number)));
      return ws.adrs.flatMap((a) => {
        if (a.number !== undefined) return [];
        const slug = a.filename.replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "decision";
        const number = String((next.get(a.project) ?? 0) + 1).padStart(4, "0");
        return [{ file: a.path, line: 1, message: `ADR file "${a.filename}" must be named NNNN-slug.md, such as ${number}-${slug}.md` }];
      });
    },
  },
  {
    id: "duplicate-adr-number",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "Two ADRs in a Project share a number, as when two pull requests each take the next free one.",
    why: "An ADR's number is its id in the Project, so two files numbered `0001` would both be `shop:0001`, and a `supersedes` naming it could mean either. It happens when two pull requests each take the next free number.",
    fix: "Renumber the later ADR to the next free number, and update any `supersedes` that meant it.",
    related: ["bad-adr-filename"],
    example: {
      failing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01"), "0001-use-redis.md": adrText("status: proposed\ndate: 2026-03-02", "Use Redis for carts") }),
      passing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01"), "0002-use-redis.md": adrText("status: proposed\ndate: 2026-03-02", "Use Redis for carts") }),
    },
    check: (ws) => {
      const first = numberedAdrs(ws);
      return ws.adrs.flatMap((a) => {
        const earlier = a.number === undefined || a.project.id === undefined ? undefined : first.get(`${a.project.id}:${a.number}`);
        return earlier && earlier !== a ? [{ file: a.path, line: 1, message: `ADR number ${a.number!} is already used in Project "${a.project.id!}" by ${earlier.path}` }] : [];
      });
    },
  },
  {
    id: "unknown-adr-link",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "An ADR's `elements` names no Element or Deployment Target, its `views` no Saved View, or its `supersedes` no ADR.",
    why: "An ADR's links are how a reader gets from an Element to the decisions behind it. A link that names nothing attaches the decision to nothing, and a `supersedes` that names no ADR leaves the old decision looking current.",
    fix: "Use an id declared in the ADR's Project, or `project:id` (`project:NNNN` for an ADR) for one in another Project.",
    related: ["unknown-element"],
    example: {
      failing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nelements: [wbe]") }),
      passing: deciding({ "0001-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nelements: [web]") }),
    },
    check: (ws) => {
      const projects = new Set(ws.projects.filter((p) => p.id !== undefined && !p.duplicateOf).map((p) => p.id!));
      const linkable = [...ws.elements, ...ws.targets];
      const adrIds = ws.adrs.flatMap((a) => (a.number === undefined ? [] : [{ id: a.number, project: a.project }]));
      const kinds = [
        { field: "elements", what: "Element or Deployment Target", decls: linkable, qualifyRef: qualify },
        { field: "views", what: "Saved View", decls: ws.views, qualifyRef: qualify },
        { field: "supersedes", what: "ADR", decls: adrIds, qualifyRef: qualifyAdr },
      ] as const;
      return ws.adrs.flatMap((a) =>
        kinds.flatMap(({ field, what, decls, qualifyRef }) => {
          const known = qualifiedIds(decls);
          return asList(a.data[field]).flatMap((ref, i) => {
            const id = qualifyRef(ref, a.project);
            if (id === undefined || known.has(id)) return [];
            const project = id.slice(0, id.indexOf(":"));
            return [atAdr(a, [field, i], projects.has(project) ? unknownIn(what, id, decls) : `Unknown Project "${project}"`)];
          });
        }),
      );
    },
  },
  {
    id: "hand-written-superseded",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "An ADR's `status` is written as `superseded`; that status is derived once an accepted ADR lists it in `supersedes`.",
    why: "An ADR is superseded once an accepted ADR lists it in `supersedes`; Archidocs derives it. Written by hand, the status could disagree with those lists, so deriving it keeps the record of what replaced what in one place.",
    fix: "Give the old ADR back the status it had (usually accepted), and declare `supersedes` on the new ADR instead.",
    related: ["supersedes-unaccepted", "superseded-twice"],
    example: {
      failing: deciding({ "0001-use-rabbitmq.md": adrText("status: superseded\ndate: 2025-01-10", "Use RabbitMQ"), "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01") }),
      passing: deciding({ "0001-use-rabbitmq.md": adrText("status: accepted\ndate: 2025-01-10", "Use RabbitMQ"), "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]") }),
    },
    check: (ws) =>
      ws.adrs.flatMap((a) =>
        a.data.status === "superseded" ? [atAdr(a, ["status"], "`superseded` is derived, never written: give this ADR the status it had, and list it in the new ADR's `supersedes`")] : [],
      ),
  },
  {
    id: "supersedes-cycle",
    severity: "error",
    area: "decisions",
    since: "1.0.0",
    summary: "ADRs supersede each other in a cycle, directly or through others. Reported once, at the cycle's last file.",
    why: "`supersedes` runs from a newer decision to the older one it replaces. In a cycle every ADR is replaced by another, so none of them is the decision that stands.",
    fix: "Remove the `supersedes` entry that points back to a newer ADR.",
    related: ["superseded-twice", "supersedes-unaccepted"],
    example: {
      failing: deciding({ "0001-use-rabbitmq.md": adrText("status: accepted\ndate: 2025-01-10\nsupersedes: [\"0002\"]", "Use RabbitMQ"), "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]") }),
      passing: deciding({ "0001-use-rabbitmq.md": adrText("status: accepted\ndate: 2025-01-10", "Use RabbitMQ"), "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]") }),
    },
    check: (ws) => {
      const entries = supersedesEntries(ws);
      const next = new Map<string, string[]>();
      for (const e of entries) if (e.target) next.set(e.id, [...(next.get(e.id) ?? []), e.to]);
      const reach = (from: string) => {
        const seen = new Set<string>();
        const todo = [...(next.get(from) ?? [])];
        while (todo.length) {
          const id = todo.pop()!;
          if (!seen.has(id)) todo.push(...(seen.add(id), next.get(id) ?? []));
        }
        return seen;
      };
      const reachable = new Map([...next.keys()].map((id) => [id, reach(id)]));
      const done = new Set<string>();
      return [...reachable].flatMap(([id, seen]): IssueDraft[] => {
        if (!seen.has(id) || done.has(id)) return [];
        const cycle = [...seen].filter((other) => reachable.get(other)?.has(id)).sort();
        cycle.forEach((c) => done.add(c));
        const last = entries
          .filter((e) => cycle.includes(e.id) && cycle.includes(e.to))
          .sort((a, b) => (a.adr.path < b.adr.path ? 1 : a.adr.path > b.adr.path ? -1 : a.index - b.index))[0]!;
        return [atAdr(last.adr, ["supersedes", last.index], `ADRs supersede each other in a cycle: ${cycle.join(", ")}`)];
      });
    },
  },
  {
    id: "superseded-twice",
    severity: "warning",
    area: "decisions",
    since: "1.0.0",
    summary: "An ADR is superseded by more than one accepted ADR. Reported at the last of them.",
    why: "A superseded ADR should lead a reader to the one decision that replaced it. When two accepted ADRs both supersede it, the reader can't tell which of them stands now.",
    fix: "Keep `supersedes` on the one ADR that replaces it; have the later one supersede that ADR instead, if it replaces it in turn.",
    related: ["supersedes-cycle", "supersedes-unaccepted"],
    example: {
      failing: deciding({
        "0001-use-rabbitmq.md": adrText("status: accepted\ndate: 2025-01-10", "Use RabbitMQ"),
        "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]"),
        "0003-use-nats.md": adrText("status: accepted\ndate: 2026-04-01\nsupersedes: [\"0001\"]", "Use NATS for events"),
      }),
      passing: deciding({
        "0001-use-rabbitmq.md": adrText("status: accepted\ndate: 2025-01-10", "Use RabbitMQ"),
        "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]"),
        "0003-use-nats.md": adrText("status: accepted\ndate: 2026-04-01\nsupersedes: [\"0002\"]", "Use NATS for events"),
      }),
    },
    check: (ws, bundle) => {
      const entries = supersedesEntries(ws);
      return bundle.adrs
        .filter((a) => a.supersededBy.length > 1)
        .map((a) => {
          const last = entries.filter((e) => e.to === a.id && a.supersededBy.includes(e.id)).sort((x, y) => (x.adr.path < y.adr.path ? 1 : -1))[0]!;
          return atAdr(last.adr, ["supersedes", last.index], `${a.id} is superseded by more than one accepted ADR: ${a.supersededBy.join(", ")}`);
        });
    },
  },
  {
    id: "supersedes-unaccepted",
    severity: "warning",
    area: "decisions",
    since: "1.0.0",
    summary: "An ADR supersedes one that isn't accepted or deprecated, such as a proposed or rejected ADR.",
    why: "To supersede a decision is to replace one that was in force. A proposed or rejected ADR never was, yet listing it in `supersedes` shows it as superseded, as if it had once been the architecture.",
    fix: "Remove the entry from `supersedes`, or point it at the accepted ADR this one replaces.",
    related: ["hand-written-superseded", "superseded-twice"],
    example: {
      failing: deciding({ "0001-use-rabbitmq.md": adrText("status: rejected\ndate: 2025-01-10", "Use RabbitMQ"), "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]") }),
      passing: deciding({ "0001-use-rabbitmq.md": adrText("status: rejected\ndate: 2025-01-10", "Use RabbitMQ"), "0002-use-kafka.md": adrText("status: accepted\ndate: 2026-03-01") }),
    },
    check: (ws) =>
      supersedesEntries(ws).flatMap(({ adr, index, to, target }) => {
        const status = target?.data.status;
        if (typeof status !== "string" || ["accepted", "deprecated", "superseded"].includes(status)) return [];
        return [atAdr(adr, ["supersedes", index], `Supersedes ${to}, which is ${status}; only an accepted or deprecated ADR is superseded`)];
      }),
  },
];

/** `count` Services as one-line YAML entries `<prefix>N: { name: <PREFIX>N }`, indented by `indent`, numbered from `from + 1`. */
function numbered(count: number, prefix: string, indent: number, from = 0): string {
  return Array.from({ length: count }, (_, i) => `${" ".repeat(indent)}${prefix}${from + i + 1}: { name: ${prefix.toUpperCase()}${from + i + 1} }\n`).join("");
}

/** Base URL of the per-rule pages on the docs site; a rule's page is `<base><rule-id>/`. */
export const RULE_DOCS_BASE_URL = "https://archidocs.dev/docs/reference/rules/";

/** The docs page for a check rule. The site keeps a page for every rule id, removed ones included. */
export const ruleDocsUrl = (ruleId: string): string => `${RULE_DOCS_BASE_URL}${ruleId}/`;

/** An issue with a link to its rule's docs page, as `check --format json` and MCP report it. */
export const withDocs = <T extends { rule: string }>(issue: T): T & { docs: string } => ({ ...issue, docs: ruleDocsUrl(issue.rule) });

/** A check rule taken out of the registry. The docs site keeps a stub page for it, so links older CLIs print still work. */
export interface RemovedRule {
  id: string;
  /** The release that removed it, such as `"1.4.0"`. */
  removedIn: string;
  /** What replaced it: another rule id, or a sentence. */
  replacement: string;
}

/** Rules removed from the registry, oldest first. An id here never returns to `rules`. */
export const removed: RemovedRule[] = [];
