# Authoring format

Type: prototype
Status: resolved
Assignee: Logan Harber
Blocked by: 01, 05
Map: [Archidocs v1](../map.md)
Context: [How existing tools model architecture](01-prior-art-modelling.md) (see its Answer and research file)

## Question

Should Projects author the Model in YAML + JSON Schema or a TypeScript API? Prototype the same sample landscape (two Projects, Deployments in two Environments, one Dynamic View) in both. Have an LLM write and edit each one, then judge readability, validation errors, diff quality in PRs, and how well it works with editors.

## Answer

Settled on 2026-11-21 by reacting to a prototype that wrote the same sample landscape in both formats: [prototypes/06-authoring-format](../prototypes/06-authoring-format/README.md).

**Projects author the Model in YAML 1.2, checked against a JSON Schema.** TypeScript authoring is rejected for v1.
- **Why:**
  - **Errors.** The same six seeded mistakes went into both formats. One `archidocs check` run on the YAML reported all six with file:line and did-you-mean. `tsc` caught five, but missed the typo in a cross-Project reference (a string). Running the TS to catch that crashed on the first error.
  - **TS still needs the checker.** TypeScript would still need the same reference checker, and it means executing code from about 50 repos in CI and in the MCP server.
  - **Diffs.** An LLM edit gave clean, local diffs in both formats. The YAML diff keeps each new Element's fields in one place.
- **One schema source:** TypeScript (zod) types in the codebase generate the JSON Schema. It is used by editors (the `yaml-language-server` `$schema` comment), by `archidocs check`, and by MCP tool inputs.
- **Validation:** `archidocs check` reports every schema and reference error in one pass, each with file:line, and suggests the nearest id. The prototype's checker is a starting list of rules for the `archidocs check` fog: unknown references, Person as provider, ancestor/descendant edges, `via`/`channel` only on async, `via` must be a broker, duplicate Deployment triples, unknown Environment/Team, and Dynamic View steps that point at missing Relationships.

**YAML shape**
- **Files:** a Project is an `archidocs/` folder in its repo. Every `*.yaml` in it is merged into one Project, so a Project can use one file or many.
- **Elements nest as a tree:** `people`, `systems > services > components`, and top-level `services`, as maps keyed by id. A Service or Component declared at the top level of any file may name its parent with `in: <id>`, which lets a subtree live in another file. Each Element is declared exactly once; files never deep-merge.
- **Relationships sit under their consumer:** a `relationships:` list on each Element, with `to`, `description`, `technology`, `interaction`, `via`, `channel`, `tags` and an optional `id`.
- **Deployment Targets** nest under `targets`. **Deployments** are a list of `{service, environment, target, url?, endpoints?}`.

**Left to other tickets**
- The prototype's `project:id` cross-Project reference syntax and its `workspace.yaml` are provisional; [Workspace aggregation](07-workspace-aggregation.md) owns them.
- The prototype's Dynamic View (steps listing Relationship ids) is provisional; [View kinds and definitions](10-view-definitions.md) owns it.

The prototype is committed on the throwaway branch `prototype/06-authoring-format` (never merged), under `.scratch/archidocs-v1/prototypes/06-authoring-format/`.
