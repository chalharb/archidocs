# Archidocs docs site

Status: ready-for-agent
Map: [Archidocs docs site](map.md)

This spec pulls together the 12 resolved tickets in [issues/](issues/). Each decision's reasoning stays in its ticket; this spec states the result. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## Problem Statement

People adopting Archidocs have no documentation site. What exists is scattered:
- the README, which is the GitHub and npm front page
- `docs/publishing.md`
- `docs/rules.md`, a generated rule catalogue
- the agent guide in `guide/`
- `GLOSSARY.md`

The 32 MCP tools and the GitHub Action's inputs are documented nowhere beyond a README list and `action.yml`. CLI flags have no descriptions anywhere. archidocs.dev serves nothing at its root domain.

Copying reference material into hand-written pages would go stale, which is the exact problem Archidocs exists to solve for diagrams. Agents are a second reader of the same docs and have no agent-friendly view of them.

## Solution

One static site at **archidocs.dev**: a landing page at `/` and the docs under `/docs/`. It's built with **Astro Starlight** from `website/` in this repo and deployed on **Vercel**. It's **latest only** and documents the released CLI.

**Reference pages are generated during the site build and never committed.** The sources are:
- the rule registry
- the JSON Schemas
- new structured CLI definitions
- the MCP tool registrations
- `guide/`
- `GLOSSARY.md`
- `CHANGELOG.md`
- diagrams exported from `examples/*`

Only guides and concepts are hand-written, and the build checks those too. Humans and agents read the same pages; agents also get `llms.txt` and a Markdown copy of each page.

## User Stories

### Adopters

1. As someone deciding whether to adopt, I see one real question answered side by side by an agent over MCP and by the viewer, and I can open the Big Bank demo in one click.
2. As a newcomer, I follow one tutorial from an empty repo to a published viewer.
3. As an author, I read how-to Guides for modelling, publishing, agents, and review and sharing.
4. As an author, I look up every field of each Model YAML file, every CLI command and flag, every MCP tool, every check rule, and the Action's inputs, and I can trust them to match the release.
5. As anyone, I search for a rule id, a partial id, a `--flag` or an `upsert_element`-style tool name, and the right reference page comes first.
6. As a reader, I see diagrams that match the live viewer in light and dark, and I can open the same View live.

### `check` users

7. As a developer reading `check` output in a terminal, a JSON report or a PR annotation, I get a link to each rule's page.
8. As someone on an older CLI, every rule link I'm given still works, even for rules the latest release has removed.

### Agents

9. As an agent, I can read `llms.txt` (full and small versions too) and a `.md` copy of any page. I'm told that `archidocs guide` and MCP `get_authoring_guide` match my installed version.

### Maintainers

10. As a maintainer, a docs change ships in the same PR as the code change, and every PR gets a preview.
11. As a maintainer, I can't merge a broken internal link, an invalid YAML sample, an unknown CLI flag in a page, or a broken tutorial.

## Implementation Decisions

### Stack ([site generator](issues/01-site-generator.md))

- **Generator:** `astro` 7.4.x and `@astrojs/starlight` 0.43.x, **pinned** because Starlight is pre-1.0.
- **Embedding:** `@astrojs/react` for React islands where needed.
- **Location:** `website/` in this repo, with its own package. Its build uses the repo's own code and CLI, not the npm release.
- **Runner-up:** Fumadocs lost on toolchain fit (Next.js) and on what a static build loses.

### Page tree ([page tree](issues/02-information-architecture.md), [content sources](issues/05-content-sources.md))

The landing page is at `/`; everything else is under `/docs/`. Sidebar groups, in order:

- **Start here:** `introduction`, `quick-start`, `tutorial` ("Model your first system": a Big Bank slice from `init` to a site published on GitHub Pages).
- **Concepts:**
  - `workspace-and-projects`, `elements`, `relationships`, `teams-and-ownership`
  - `deployments`, `views`, `revisions-and-history`, `decisions`
  - `viewer`, `agents-and-mcp`
- **Guides:**
  - `model/`: `add-a-project`, `add-a-service`, `connect-services`, `add-deployments`, `save-a-view`, `dynamic-views`, `record-an-adr`, `rename-move-remove`
  - `publish/`: `github-pages`, `gitlab-pages`, `pr-previews`, `saved-view-images`, `other-hosts`
  - `agents/`: `connect-mcp`, `install-skill`, `bootstrap-from-code`
  - `review/`: `diff`, `export`
- **Reference:**
  - `cli/`: one page per command
  - `model/`: `workspace-yaml`, `project-yaml`, `model-yaml`, `deployments-yaml`, `views-yaml`, `adr-frontmatter`
  - `mcp/`: `read-tools` and `write-tools`, with an anchor per tool
  - `ci/`: `github-action` and `gitlab-template`
  - `rules/`: an index plus one page per rule, at `/docs/reference/rules/<rule-id>/`
  - `agent-guide/`
  - `glossary`
  - `changelog`
- **Examples:** `big-bank` and `kitchen-sink`, each linking to its live demo.

Search terms: every rule id, CLI flag and MCP tool name is a **page title or its own heading**. With that, untuned Pagefind ranks the right page first, so set no Pagefind options ([search](issues/09-search-identifiers.md)).

### Content sources ([content sources](issues/05-content-sources.md))

| Pages | Source | Notes |
| --- | --- | --- |
| `reference/rules/` | Rule registry, `src/core/rules.ts` | Removed rules keep a stub page, generated from a `removed` list kept beside the registry. |
| `reference/model/` | `schemas/*.schema.json` | `model.schema.json` is split by top-level key across `model-yaml`, `deployments-yaml` and `views-yaml`. Each page has a hand-written intro and a Kitchen sink example. |
| `reference/cli/` | **New structured command definitions** | The same definitions drive the CLI's usage text. |
| `reference/mcp/` | The build starts the server in-process and calls `listTools` | Renders each tool's title, description and input and output schemas. |
| `reference/agent-guide/` | `guide/` | Rendered as it is; links are rewritten (the `rules` topic → `reference/rules/`). |
| `reference/glossary` | `GLOSSARY.md` | Rendered as it is. |
| `reference/changelog` | `CHANGELOG.md` | Until release-please writes it, the page is a one-line pointer to GitHub Releases. |
| `reference/ci/` | `action.yml`, `templates/gitlab` | The inputs table is generated; usage examples are hand-written. |
| Diagrams | `examples/*` Saved Views | Exported with the repo's own CLI. |
| All other pages | Hand-written `.mdx` | Under `website/src/content/docs/docs/<group>/`. |

Generated pages come from custom Starlight content loaders and are never written to disk or committed.

### Diagrams ([diagrams](issues/03-diagrams-in-docs.md), [dark theme](issues/12-dark-theme-diagrams.md), [build and deploy](issues/07-build-and-deploy.md))

- **What a page shows:** a static `archidocs export` SVG with an "Open in the live viewer" link to the same View on the demo site, e.g. `https://big-bank.archidocs.dev/#/view/digital:mainframe-outage`. Pages never embed the live viewer.
- **Export restyle:** the export is restyled to the **Wayfinding Plate tokens**, read from **one token source shared with the viewer's CSS**. No opacity fades.
- **Themes:** `archidocs export` gains `--theme light|dark` (default light; dark uses the viewer's Night shift tokens). Docs pages render both and swap with CSS on Starlight's `[data-theme]`. The landing page uses light only.
- **Header label:** `archidocs export` gains an option to set the header label. The site stamps `<Example name> · v<release>` instead of the checkout folder and commit.

### Landing page ([landing page](issues/06-landing-page.md))

- **Structure:** "Twin screens".
  - A slate sign plate holds the hero, headline "One architecture. Same answer for people and agents."
  - The primary button is **Open the Big Bank demo**; the secondary is **Read the quick start**.
  - An "asked twice" question bar, then twin panes: the agent's real `get_impact` call (expandable to its JSON) and the viewer showing the Impact lens on the same View.
  - Then a YAML file splitting into the viewer and MCP, then the six persona questions with each one's viewer lens and MCP tool.
- **Proof:** only real Big Bank output, captured at build time. No testimonials or figures.
- **Direction contract:** `.impeccable/surfaces/website-src-pages-index-astro.md`.

### Agents ([agents as readers](issues/04-agents-as-readers.md))

- **Agent files:** `starlight-llms-txt` writes `llms.txt`, `llms-full.txt` and `llms-small.txt` (the small one leaves out Examples and the Changelog). The landing page is left out of all three.
- **Markdown copies:** `starlight-llm-actions` serves a `.md` copy at `<page>.md` and adds "Copy as Markdown". If it can't write static files, a hand-written endpoint that returns `entry.body` replaces it.
- **Pointer:** the top of `llms.txt` and the agents-and-MCP concept page point agents to `archidocs guide` and `get_authoring_guide` for their installed version.
- **Two sources:** human Guides and agent topics are separate, hand-written, and cross-linked.

### `check` links ([check links](issues/11-check-links-to-rules.md))

Links are always on:
- **`--format json` and MCP `validation_failed`:** a `docs` URL per issue.
- **`--format text`:** a Rule docs footer listing each distinct rule's URL once.
- **`--format github`:** each annotation ends with `See <url>`.

### Moving existing docs ([content sources](issues/05-content-sources.md), [README cut](issues/10-readme-cut.md))

- **Delete:** `docs/rules.md`, `scripts/rule-catalogue.ts`, the `rules:catalogue` script, and the test that compares the file. `ruleCatalogue()` stays, because the agent guide's `rules` topic uses it.
- **Split and delete:** `docs/publishing.md` becomes the five `guides/publish/` pages. Repoint the comments in `action.yml` and `templates/gitlab/archidocs.gitlab-ci.yml` to their site URLs.
- **README:** cut to about 70 lines, keeping the pitch with a docs link, Why, Quick start, Examples, Development and License. The Model, CLI, Publishing, and Agents and MCP sections each become one or two sentences plus a link. The cut ships in the same PR as the first site deploy.

### Build and deploy ([build and deploy](issues/07-build-and-deploy.md))

- **Vercel project:** the existing root Vercel project (today's always-failing "Vercel" check) becomes the docs site, with root directory `website/`. `website/vercel.json` follows the `examples/*` pattern: `framework: null`, install at the repo root with `--frozen-lockfile`, output to `website/dist`.
- **Builds run on Vercel.**
- **Previews:** every PR and every push to `main` gets a preview.
- **Production deploys only from a release tag** created by release-please, through an Ignored Build Step or a deploy hook from `publish.yml`. There's no manual docs redeploy; urgent docs fixes ship as a patch release.
- **DNS:** the `archidocs.dev` apex and `www` (which redirects to the apex) point to the project, DNS-only on Cloudflare. The demo subdomains stay as they are.

## Testing Decisions

([hand-written correctness](issues/08-hand-written-correctness.md))

- **Internal links:** `starlight-links-validator` fails the build on a broken internal link or anchor, including links to generated rule, flag and tool pages.
- **External links:** a weekly scheduled job (e.g. lychee) checks external links, including the README's, and opens an issue when one breaks. It isn't part of the build.
- **YAML samples:** samples on hand-written pages are included from files in `examples/`, by path and an optional named region. Samples that are wrong on purpose live in `website/samples/`, and a test checks that each fails with exactly the rule its page names.
- **CLI lines:** every `archidocs …` line in a page and in the README is parsed against the structured CLI definitions, and an unknown command or flag fails the build. Commands aren't run.
- **Tutorial:** an end-to-end CI test runs its steps (`init`, write files, `check`, `build`) in a temp folder on every PR.
- **Other tests:** unit tests cover the structured CLI definitions (they produce today's usage text), the export's `--theme` and label options, and the `docs` field in `check` output.

## Build Tickets

The build tickets are in [docs-site-build/issues/](../docs-site-build/issues/). Tickets 1, 2, 3 and 5 don't depend on each other.

1. **Structured CLI definitions:** commands and flags with descriptions, driving the usage text. Unblocks the CLI reference and the CLI-line check.
2. **Export restyle:** shared Wayfinding Plate tokens for the viewer and the export, no fades, plus `--theme light|dark` and a header label option.
3. **`check` rule links:** a `docs` field in json and MCP, a text footer, the GitHub `See` link, and a `removed` rule list.
4. **`website/` scaffold:** Starlight, the page tree, the generated-content loaders (rules with stubs, schemas, MCP tools, agent guide, glossary, changelog, CI inputs, diagrams), the LLM plugins, and the links validator. Depends on 1–3 for some of its pages.
5. **Vercel and DNS:** repurpose the root project, set production to release tags only, and point the apex and `www` at it. HITL (Vercel and Cloudflare dashboards).
6. **Hand-written content:** Start here (with the tutorial and its end-to-end test), Concepts, Guides (splitting `docs/publishing.md`), Examples, and the failure samples.
7. **Landing page:** built to the direction contract, with the real `get_impact` output captured at build time.
8. **Cutover:** delete `docs/rules.md` and its script and test, repoint the comments, cut the README, add the weekly link check, and do the first production deploy.

## Out of Scope

- **Per-release copies of the docs:** a likely future state. Starlight and the `/docs/` prefix leave room for them at `/docs/1.x/`.
- **A blog.**
- **Contributor docs:** these stay in the README and `AGENTS.md`.
- **An Action `theme` input** for dark Saved View images.
- **Documenting the Bundle format,** which stays internal.
- **A viewer manual:** one Concepts page explains the viewer instead.

## Further Notes

- **Throwaway branches:** prototypes and research live on branches that are never merged: `research/site-generator`, `research/search-identifiers`, `prototype/diagrams-in-docs` and `prototype/landing-page`.
- **Memory note:** once the root Vercel project builds the site, the "Vercel" check will pass. The note to ignore it no longer applies then.
