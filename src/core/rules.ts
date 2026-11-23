import type { Files } from "./files.ts";
import { Id, parentKindOf, type ElementKind } from "../schema/workspace.ts";
import type { ElementDecl, Finding, IssueDraft, LoadedWorkspace, Severity, SourceFile } from "./model.ts";
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

const at = (file: SourceFile, path: string[], message: string, key = false): IssueDraft => {
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
      const issues: IssueDraft[] = [];
      for (const p of ws.projects) {
        if (p.owner !== undefined && !teams.has(p.owner)) issues.push(at(p.file, ["owner"], message(p.owner)));
      }
      for (const e of ws.elements) {
        const owner = e.data.owner;
        if (typeof owner === "string" && !teams.has(owner)) issues.push(at(e.file, [...e.path, "owner"], message(owner)));
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
    summary: "A reference names no Element.",
    fix: "Use the id of an Element declared in the Project, or declare it.",
    example: {
      failing: withServices("systems:\n  checkout:\n    name: Checkout\n", { "shop/cart.yaml": "services:\n  cart:\n    name: Cart\n    in: chekout\n" }),
      passing: withServices("systems:\n  checkout:\n    name: Checkout\n", { "shop/cart.yaml": "services:\n  cart:\n    name: Cart\n    in: checkout\n" }),
    },
    check: (ws) =>
      ws.elements.flatMap((e) => {
        const ref = inRef(e);
        if (ref === undefined || e.nestedIn || e.parent) return [];
        const ids = ws.elements.filter((o) => o.project === e.project).map((o) => o.id);
        return [at(e.file, [...e.path, "in"], `Unknown Element "${ref}" in Project "${e.project.id ?? e.project.folder}"${didYouMean(ref, ids)}`)];
      }),
  },
];
