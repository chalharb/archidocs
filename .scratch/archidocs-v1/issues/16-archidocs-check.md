# archidocs check

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 07
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) reuses this ticket's `{file, line, rule, message}` issue records in MCP errors and the `check` tool. [View kinds and definitions](10-view-definitions.md) lists the View errors and warnings this ticket assigns rule ids to.

## Question

What exactly does `archidocs check` validate and report? It runs once over the whole Workspace repo ([Workspace aggregation](07-workspace-aggregation.md)). Settle: the full list of rules, starting from [Authoring format](06-authoring-format.md)'s prototype list plus the Workspace rules (nested `project.yaml`, model files outside a Project, duplicate Project ids, Teams or Environments outside `workspace.yaml`, unknown `project:id` references); which are errors and which are warnings; the output format (human and machine-readable, for CI annotations and MCP write tools); and exit codes.

## Answer

Settled in a grilling session on 2026-11-22. No glossary change: rule, issue and severity are terms of the tool, not of the architecture domain.

**Command**
- `archidocs check` validates the whole Workspace in one pass ([Workspace aggregation](07-workspace-aggregation.md)) and writes nothing.
- `archidocs build` runs exactly the same checks and refuses to write `workspace.bundle.json` if there is any error.
- One shared validator backs `check`, `build` and the MCP write tools ([MCP tool surface](08-mcp-tool-surface.md)). Write tools refuse on errors only; warnings never block.
- It keeps going after errors. A YAML syntax error in one file is an issue, not a crash.
- **Cascades:** an Element whose declaration fails the schema still registers its id, so only the root cause is reported. An id is lost only when its file can't be parsed at all.
- **Not configurable in v1:** no config file to turn rules off or change severity, and no inline suppression comments.

**Issue record**
- `{file, line, column?, rule, severity, message}`, where `severity` is `error | warning`. This extends [MCP tool surface](08-mcp-tool-surface.md)'s `{file, line, rule, message}` with `severity` and an optional `column`.
- `file` is relative to the repo root. The did-you-mean suggestion goes in `message`.
- Issues are sorted by file, then line, then rule.
- An issue that involves two places (for example a duplicate Project id) is reported once, at the later location in path order, and its message names the other.

**Output**
- `--format text` (default): grouped by file, `file:line:col  severity  rule  message`, with a summary count. Colour only on a terminal.
- `--format json`: `{issues: [...], summary: {errors, warnings}}`, with the same records as MCP.
- `--format github`: `::error file=…,line=…,col=…,title=<rule>::<message>` workflow commands for inline PR annotations.
- SARIF is not in v1.

**Exit codes**
- `0`: no errors (warnings allowed).
- `1`: at least one error, or any warning with `--strict`.
- `2`: could not run (no `workspace.yaml` found walking up, a bad flag, an internal crash).

**Rule ids**
- Plain kebab-case names, unique across the tool. A rule id is stable once shipped and never reused.
- The catalogue (id, severity, meaning, a failing example, the fix) is generated from the rule definitions in code. It is published in the docs and in `get_authoring_guide`, so agents can look up a rule id. No `--explain` flag in v1.

**Rules.** All are errors except the two marked warning.

| Area | Rule | Fires when |
|---|---|---|
| Parse | `yaml-syntax` | a file can't be parsed |
| Schema | `unknown-field` | a key isn't in the schema (did-you-mean against the allowed keys) |
| | `missing-field` | a required field is absent |
| | `invalid-value` | wrong type, bad enum value, malformed URL |
| Workspace | `nested-project` | a `project.yaml` sits inside another Project's folder |
| | `file-outside-project` | a model file is under no Project |
| | `duplicate-project-id` | two Projects share an id |
| | `definition-outside-workspace` | `teams` or `environments` declared outside `workspace.yaml` |
| | `own-project-prefix` | a Project qualifies its own ids |
| References | `unknown-project` | a `project:` prefix names no Project |
| | `unknown-element` | in `to`, `via`, `in`, View selectors, Steps or `participants` |
| | `unknown-team` | in `owner` or a `{team}` selector |
| | `unknown-environment` | in a Deployment or a View's `environment` |
| | `unknown-target` | in a Deployment or a View's `targets` |
| | `wrong-kind` | an id resolves to a kind the field doesn't accept (a Deployment's `service` naming a Component or System, a Deployment View selecting a Person) |
| Elements | `duplicate-id` | an Element or Deployment Target id is declared twice in a Project, across files too |
| | `invalid-nesting` | System > Service > Component is broken, by nesting or `in:` |
| | `external-with-components` | an External System or Service declares Components |
| Relationships | `duplicate-relationship-id` | a Relationship `id` repeats in a Project |
| | `self-relationship` | an Element has a Relationship to itself |
| | `person-as-provider` | the provider is a Person |
| | `ancestor-descendant-relationship` | an Element is linked to its own ancestor or descendant |
| | `via-on-sync` | `via` or `channel` on a sync Relationship |
| | `via-not-broker` | `via` isn't a `type: broker` Service |
| Deployments | `duplicate-deployment` | the same Service, Environment and Target appear twice |
| Views | `duplicate-view-id` | a View id repeats in a Project |
| | `missing-step` | no Relationship or derived edge between `from` and `to`, or the named `relationship` doesn't connect them |
| | `ambiguous-step` | several Relationships match and no `relationship` is given |
| | `return-without-relationship` | a return Step has no opposite Relationship |
| | `ancestor-descendant-participants` | an ancestor and its descendant are both participants |
| | `target-outside-environment` | a `targets` entry is outside the View's `environment` |
| | `empty-view` (warning) | a Saved View resolves to no nodes |
| | `oversized-view` (warning) | a View resolves to more than 150 nodes |

**Not in v1**
- Lint-style warnings: orphan Elements, unused Targets, Teams or Environments, Services without Deployments, Deployments without a `url`. They have legitimate exceptions and would become noise; coverage gaps belong in a later report or the viewer.

**Left to other tickets**
- ADR rules (unknown linked Element, bad status, broken `supersedes`, and so on) are added by [ADR format and linking](11-adr-format.md) under this scheme.
