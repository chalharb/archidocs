# Which content is generated and which is hand-written

Type: grilling
Status: resolved
Blocked by: 01, 02
Map: [Archidocs docs site](../map.md)

## Question

For each page in the page tree, is it generated from repo files or hand-written, and from which source? Include the diagram SVGs rendered from `examples/*` Saved Views (see the diagrams ticket). Cover the rules catalogue, JSON Schemas (Model YAML reference), CLI reference (from what source: the command definitions or `--help` output?), MCP tool reference, `guide/` topics, `GLOSSARY.md` and `CHANGELOG.md`. Where do the moved `docs/*.md` files live under `website/`, what paths in code, tests and the npm package refer to them today, and what does the README keep?

## Answer

**Generated pages are built during the site build and never committed.** Custom Starlight content loaders produce them, so there's nothing to drift. Only hand-written pages can be wrong.

| Page(s) | Source | How |
| --- | --- | --- |
| `reference/rules/` (index + one page per rule) | Rule registry, `src/core/rules.ts` | The loader reads the registry directly. **Delete** `docs/rules.md`, `scripts/rule-catalogue.ts`, the `rules:catalogue` script and the catalogue-file test. `ruleCatalogue()` stays, because the agent guide's `rules` topic uses it. |
| `reference/model/` `workspace-yaml`, `project-yaml` | `schemas/workspace.schema.json`, `project.schema.json` | Field tables generated from the schema. |
| `reference/model/` `model-yaml`, `deployments-yaml`, `views-yaml` | `schemas/model.schema.json` (one schema for every other Project `.yaml`) | Split by top-level key: Elements and Relationships / Deployment Targets and Deployments / Views. |
| `reference/model/adr-frontmatter` (**new page**, added to the page tree) | `schemas/adr.schema.json` | Field tables. |
| `reference/cli/` (a page per command) | **Structured command definitions** (new; today the usage text is one string and flags have no descriptions) | The same definitions drive the CLI's usage text and the docs. Building them is a build-effort ticket. |
| `reference/mcp/` `read-tools`, `write-tools` | MCP tool registrations | The build starts the server in-process, calls `listTools`, and renders each tool's title, description and input/output schemas, with an anchor per tool. |
| `reference/agent-guide/` | `guide/SKILL.md` + `guide/topics/*` | Rendered as they are from `guide/`; only links are rewritten (the `rules` topic → `reference/rules/`). |
| `reference/glossary` | `GLOSSARY.md` | Rendered as it is from the repo root; links rewritten. |
| `reference/changelog` | `CHANGELOG.md` | Rendered once release-please writes it (it doesn't exist yet, because 1.0.0 predates release-please). Until then, a one-line pointer to GitHub Releases. |
| `reference/ci/` | `action.yml` inputs/outputs; `templates/gitlab` | The inputs/outputs table is generated from `action.yml`. Usage examples are hand-written. |
| Diagram SVGs (Concepts, Examples, Tutorial) | `examples/*` Saved Views | The site build runs the repo's own CLI (`node src/cli/main.ts export --all-saved`, not the npm release), so they match the demos built from the same commit. |
| Every other page (Start here, Concepts, Guides, Examples, and the intros and examples on reference pages) | Hand-written | `.mdx` in `website/src/content/docs/docs/<group>/…`. Examples on Model YAML pages are taken from the Kitchen sink. |

**Moving `docs/publishing.md`:** split it by hand into the five `guides/publish/` pages, then delete it. Repoint these to `archidocs.dev/docs/guides/publish/…` URLs:
- the comment in `action.yml`
- the comment in `templates/gitlab/archidocs.gitlab-ci.yml`
- the README

After the move, only `docs/agents/` remains under `docs/`.

**What links to the moved files today:**
- **README:** both files.
- **`action.yml` and the GitLab template:** comments pointing to `docs/publishing.md`.
- **`scripts/rule-catalogue.ts` and `test/core/catalogue.test.ts`:** both use `docs/rules.md`.
- **npm package:** none; it ships only `dist`, `guide` and `schemas`.

The README cut is still an open item on the map.
