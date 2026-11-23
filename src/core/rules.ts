import type { Bundle } from "../schema/bundle.ts";
import type { Files } from "./files.ts";
import { generatedViews, MAX_VIEW_NODES } from "./views.ts";
import { resolveSaved, type SavedResolution } from "./saved-views.ts";
import { Id, parentKindOf, type ElementKind } from "../schema/workspace.ts";
import type { ElementDecl, Finding, IssueDraft, LoadedWorkspace, Project, RelationshipDecl, Severity, SourceFile, TargetDecl, ViewDecl } from "./model.ts";
import { qualified, qualify, referenceResolver, type Resolved } from "./refs.ts";
import type { BundleView } from "../schema/bundle.ts";
import { didYouMean } from "./suggest.ts";

/**
 * A check rule. Its examples are small Workspaces (paths relative to the
 * Workspace root): `failing` triggers the rule, `passing` is the same
 * Workspace with the fix applied and has no issues at all.
 */
export interface RuleDefinition {
  id: string;
  severity: Severity;
  summary: string;
  fix: string;
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

/** The Element references a Saved View makes: bare-id and `{element}` and path selectors, `expand`, `collapse` and the Lens. */
function viewElementRefs(v: ViewDecl): ViewValue[] {
  const out: ViewValue[] = [];
  for (const key of ["include", "exclude"] as const) {
    asList(v.data[key]).forEach((s, i) => {
      if (typeof s === "string") out.push({ path: [key, i], value: s });
      else for (const field of ["element", "from", "to"]) if (field in asRecord(s)) out.push({ path: [key, i, field], value: asRecord(s)[field] });
    });
  }
  for (const key of ["expand", "collapse"] as const) asList(v.data[key]).forEach((id, i) => out.push({ path: [key, i], value: id }));
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

/** Each Saved View that made it into the Bundle (the first of a repeated id), with its definition and resolution; Deployment Views aren't resolved. */
const resolvedSavedViews = (ws: LoadedWorkspace, bundle: Bundle): { decl: ViewDecl; def: BundleView; resolution: SavedResolution }[] =>
  ws.views.flatMap((decl) => {
    const def = bundle.views.find((v) => v.id === `${decl.project.id}:${decl.id}` && v.source.file === decl.file.path && v.source.line === decl.line);
    const resolution = def && resolveSaved(bundle, def);
    return def && resolution ? [{ decl, def, resolution }] : [];
  });

const targetAncestry = (t: TargetDecl): TargetDecl[] => {
  const out = [t];
  for (let p = t.parent; p && !out.includes(p); p = p.parent) out.push(p);
  return out;
};

/** A Saved View example: two Services, one with a Component, and `views: structural:` given as the YAML under it. */
const viewing = (views: string, extra: Files = {}) =>
  withServices(
    `services:\n  web:\n    name: Web\n    relationships:\n      - to: cart\n  cart:\n    name: Cart\n    components:\n      cart-api:\n        name: Cart API\n  search:\n    name: Search\nviews:\n  structural:\n${views.replace(/^/gm, "    ")}\n`,
    extra,
  );

export const rules: RuleDefinition[] = [
  {
    id: "yaml-syntax",
    severity: "error",
    summary: "A file can't be parsed as YAML.",
    fix: "Correct the YAML syntax at the reported position.",
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
    summary: "A key isn't in the schema.",
    fix: "Remove the key, or correct its spelling to the suggested field.",
    example: {
      failing: withServices("services:\n  web:\n    name: Web\n    techology: Go\n"),
      passing: withServices("services:\n  web:\n    name: Web\n    technology: Go\n"),
    },
    check: findings("unknown-field"),
  },
  {
    id: "missing-field",
    severity: "error",
    summary: "A required field is absent.",
    fix: "Add the missing field.",
    example: {
      failing: withServices("services:\n  web:\n    technology: Go\n"),
      passing: withServices("services:\n  web:\n    name: Web\n    technology: Go\n"),
    },
    check: findings("missing-field"),
  },
  {
    id: "invalid-value",
    severity: "error",
    summary: "A value has the wrong type, a bad enum value or a malformed URL.",
    fix: "Change the value to one the field accepts.",
    example: {
      failing: withServices("services:\n  orders-db:\n    name: Orders DB\n    type: database\n"),
      passing: withServices("services:\n  orders-db:\n    name: Orders DB\n    type: datastore\n"),
    },
    check: findings("invalid-value"),
  },
  {
    id: "nested-project",
    severity: "error",
    summary: "A `project.yaml` sits inside another Project's folder.",
    fix: "Move the inner Project's folder out of the outer Project's folder.",
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
    summary: "A model file is under no Project.",
    fix: "Move the file into a Project folder (one with a `project.yaml`).",
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
    summary: "Two Projects share an id.",
    fix: "Give one of the Projects a different id.",
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
    summary: "`teams` or `environments` declared outside `workspace.yaml`.",
    fix: "Move the definitions into `workspace.yaml` at the Workspace root.",
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
    summary: "An `owner`, or a Saved View's `{team}` selector or Team Lens, names no Team.",
    fix: "Use the id of a Team defined in `workspace.yaml`, or define the Team there.",
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
    summary: "An Element or Deployment Target id is declared twice in a Project, across files too, whatever its kind or nesting.",
    fix: "Rename one of the Elements or Targets, or remove the second declaration.",
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
    summary: "System > Service > Component is broken, by nesting or `in:`.",
    fix: "Move the Element under a parent of the right kind (a Service under a System, a Component under a Service), or point `in:` at one.",
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
    summary: "An External System or Service declares Components.",
    fix: "Remove the Components, or drop `external` if the organisation runs the Element itself.",
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
    summary: "A reference names no Element: in `to`, `via`, `in`, a Deployment's `service`, or a Saved View's selectors, `expand`, `collapse` or Lens.",
    fix: "Use the id of an Element declared in the Project, or declare it.",
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
    summary: "A `project:` prefix names no Project.",
    fix: "Correct the prefix to the id of an existing Project.",
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
    summary: "A Project qualifies its own ids.",
    fix: "Drop the `project:` prefix; within its own Project an id is written bare.",
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
    summary: "A Relationship `id` repeats in a Project.",
    fix: "Give one of the Relationships a different id.",
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
    summary: "An Element has a Relationship to itself.",
    fix: "Point `to` at the Element depended on, or remove the Relationship.",
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
    summary: "The provider of a Relationship is a Person.",
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
    summary: "An Element is linked to its own ancestor or descendant.",
    fix: "Point `to` at an Element outside the consumer's own branch, such as a sibling.",
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
    summary: "`via` or `channel` on a sync Relationship.",
    fix: "Set `interaction: async` if the Relationship runs through a broker, or remove `via` and `channel`.",
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
    summary: "`via` names a Service that isn't `type: broker`.",
    fix: "Point `via` at a broker Service, or mark the Service `type: broker`.",
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
    summary: "The same Service, Environment and Target appear twice.",
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
    summary: "A Deployment, or a Saved Deployment View, names no Environment.",
    fix: "Use the id of an Environment defined in `workspace.yaml`, or define the Environment there.",
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
    summary: "A Deployment, or a Saved Deployment View's `targets`, names no Deployment Target.",
    fix: "Use the id of a Target declared in the Project, or `project:id` for one declared in another Project.",
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
    summary: "An id resolves to a kind the field doesn't accept, such as a Deployment's `service` naming a Component or System, or a Relationship's `via` naming something other than a Service.",
    fix: "Point the field at an id of the kind it accepts: a Deployment's `service` and a Relationship's `via` each name a Service.",
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
    summary: `A View has more than ${MAX_VIEW_NODES} nodes, too many for a readable diagram. A Generated View is reported at its System or Service, or at \`workspace.yaml\` for the Landscapes; a Saved View at its id.`,
    fix: "Split the System, or group top-level Services and Systems, so each Generated View stays within the limit; narrow a Saved View's selectors or raise its `level`.",
    example: {
      failing: withServices(`systems:\n  big:\n    name: Big\n    services:\n${numbered(MAX_VIEW_NODES, "s", 6)}`),
      passing: withServices(
        `systems:\n  big:\n    name: Big\n    services:\n${numbered(MAX_VIEW_NODES / 2, "s", 6)}  more:\n    name: More\n    services:\n${numbered(MAX_VIEW_NODES / 2, "s", 6, MAX_VIEW_NODES / 2)}`,
      ),
    },
    check: (ws, bundle) => {
      const workspaceFile = ws.files.find((f) => f.role === "workspace");
      const generated = generatedViews(bundle)
        .filter((v) => v.nodes.length > MAX_VIEW_NODES)
        .flatMap((v) => {
          const focus = bundle.elements.find((e) => e.id === v.id.slice(v.id.indexOf("/") + 1));
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
    summary: "A Saved View id repeats in a Project, across files too.",
    fix: "Give one of the Views a different id.",
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
    id: "target-outside-environment",
    severity: "error",
    summary: "A Saved Deployment View's `targets` entry has no Deployment in the View's `environment`, on it or on any Target inside it.",
    fix: "Remove the Target from `targets`, or point the View at the Environment that runs on it.",
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
    summary: "A Saved View's `expand` or `collapse` id is not a node of the View once collapsed to its `level`, or has no children.",
    fix: "Remove the id, include the Element in the View, or name an Element that has children.",
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
    summary: "A Saved View resolves to no nodes.",
    fix: "Correct the selectors so they name Elements, or remove the View.",
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
    summary: "A Saved View's path selector, or path Lens, finds no path between its two Elements.",
    fix: "Check the Relationships between the two Elements, or raise `paths`; remove the selector if the path is gone for good.",
    example: {
      failing: viewing("front:\n  title: Front\n  level: c2\n  include: [{ from: web, to: search }]"),
      passing: viewing("front:\n  title: Front\n  level: c2\n  include: [{ from: web, to: cart }]"),
    },
    check: (ws, bundle) =>
      resolvedSavedViews(ws, bundle).flatMap(({ decl, resolution }) =>
        resolution.unresolvedPaths.map((u) => at(decl.file, [...decl.path, ...u.at], `No path between "${u.from}" and "${u.to}"`)),
      ),
  },
];

/** `count` Services as one-line YAML entries `<prefix>N: { name: <PREFIX>N }`, indented by `indent`, numbered from `from + 1`. */
function numbered(count: number, prefix: string, indent: number, from = 0): string {
  return Array.from({ length: count }, (_, i) => `${" ".repeat(indent)}${prefix}${from + i + 1}: { name: ${prefix.toUpperCase()}${from + i + 1} }\n`).join("");
}
