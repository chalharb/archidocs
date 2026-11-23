import type { Files } from "./files.ts";
import { Id, parentKindOf, type ElementKind } from "../schema/workspace.ts";
import type { ElementDecl, Finding, IssueDraft, LoadedWorkspace, RelationshipDecl, Severity, SourceFile } from "./model.ts";
import { qualified, referenceResolver } from "./refs.ts";
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
  check(workspace: LoadedWorkspace): IssueDraft[];
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
    summary: "An `owner` names no Team.",
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
      for (const e of ws.elements) {
        const owner = e.data.owner;
        if (unknown(owner)) issues.push(at(e.file, [...e.path, "owner"], message(owner)));
      }
      return issues;
    },
  },
  {
    id: "duplicate-id",
    severity: "error",
    summary: "An Element id is declared twice in a Project, across files too, whatever its kind or nesting.",
    fix: "Rename one of the Elements, or remove the second declaration.",
    example: {
      failing: withServices("services:\n  web:\n    name: Web\n", { "shop/more.yaml": "services:\n  web:\n    name: Web v2\n" }),
      passing: withServices("services:\n  web:\n    name: Web\n", { "shop/more.yaml": "services:\n  web-v2:\n    name: Web v2\n" }),
    },
    check: (ws) => {
      const seen = new Map<string, { file: string; line: number }>();
      const issues: IssueDraft[] = [];
      for (const e of ws.elements) {
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
    summary: "A reference names no Element: in `to`, `via` or `in`.",
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
      const references = resolvedRefs(ws).flatMap(({ r, field, resolved }) => {
        if (resolved.ok || resolved.reason !== "unknown-element") return [];
        const own = resolved.project === r.from.project;
        const ids = ws.elements.filter((o) => o.project === resolved.project).map((o) => (own ? o.id : qualified(o)));
        const input = own ? resolved.id : `${resolved.project.id}:${resolved.id}`;
        return [at(r.file, [...r.path, field], `Unknown Element "${resolved.id}" in Project "${resolved.project.id}"${didYouMean(input, ids)}`)];
      });
      return [...parents, ...references];
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
      return resolvedRefs(ws).flatMap(({ r, field, ref, resolved }) => {
        if (resolved.ok || resolved.reason !== "unknown-project") return [];
        // The nearest qualified id names the Element meant; failing that, the nearest Project.
        const hint = didYouMean(ref, elementIds) || didYouMean(resolved.project, projectIds);
        return [at(r.file, [...r.path, field], `Unknown Project "${resolved.project}" in "${ref}"${hint}`)];
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
      resolvedRefs(ws).flatMap(({ r, field, ref, resolved }) =>
        resolved.ok && resolved.ownPrefix ? [at(r.file, [...r.path, field], `Write "${resolved.element.id}", not "${ref}", inside Project "${r.from.project.id}"`)] : [],
      ),
  },
  {
    id: "wrong-kind",
    severity: "error",
    summary: "An id resolves to a kind the field doesn't accept, such as a `via` naming something other than a Service.",
    fix: "Point the field at an Element of the kind it accepts.",
    example: {
      failing: relating("to: cart\ninteraction: async\nvia: checkout", `${cart}systems:\n  checkout:\n    name: Checkout\n`),
      passing: relating("to: cart\ninteraction: async\nvia: events", `${cart}${events("broker")}`),
    },
    check: (ws) =>
      resolvedRefs(ws).flatMap(({ r, field, ref, resolved }) =>
        field === "via" && resolved.ok && resolved.element.kind !== "service"
          ? [at(r.file, [...r.path, field], `\`via\` must name a broker Service, but "${ref}" is a ${kindName[resolved.element.kind]}`)]
          : [],
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
];
