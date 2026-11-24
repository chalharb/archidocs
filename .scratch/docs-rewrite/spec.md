# Docs rewrite proposal

Status: ready-for-agent
Builds on: [Archidocs docs site](../docs-site/spec.md)

A review of everything published under `archidocs.dev/docs/` at v1.2.0, measured against how established open source projects structure and write their docs, with a proposal for what to rewrite. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## Verdict

The site's **machinery is ahead of most open source docs**: reference generated from the code, samples included from tested examples, CLI lines and links checked in the build, `llms.txt` and Markdown copies. Keep all of it.

The **content is behind**. It reads as a precise specification written by people who already know the product. The standard it misses is about the reader's path: a first success in five minutes, pages that do one job each, reference entries that explain every field, and the pages people look for when something goes wrong. Five things matter most:

1. The quick start can't be completed from the page.
2. Concepts, Guides and Reference repeat each other instead of each doing one job.
3. Generated reference covers everything but explains little: 71% of Model YAML field rows have no description.
4. The viewer, the product's main surface, has no screenshots and no task guides.
5. The standard "front door" pages are missing: installation, troubleshooting, upgrading, comparison, contributing.

## What was reviewed

| Part | Pages | Source |
| --- | --- | --- |
| Start here | 3 + docs home | Hand-written |
| Concepts | 10 | Hand-written |
| Guides | 18 (model 8, publish 5, agents 3, review 2) | Hand-written |
| Examples | 2 | Hand-written |
| Reference: CLI | index + 10 commands | `src/cli/commands.ts` |
| Reference: Model YAML | 6 | `schemas/*.schema.json` + hand-written intros |
| Reference: MCP tools | 2 (31 tools) | `listTools` at build |
| Reference: Check rules | index + 45 rules | `src/core/rules.ts` |
| Reference: CI | 2 | `action.yml`, GitLab template |
| Reference: agent guide, Glossary, Changelog | 11 | `guide/`, `GLOSSARY.md`, `CHANGELOG.md` |

Hand-written pages total about 13,500 words.

## The standard

- **[Diátaxis](https://diataxis.fr):** four page types that don't mix. Tutorials teach, how-to guides complete a task, reference describes, explanation gives the why. Kubernetes (Concepts / Tasks / Tutorials / Reference), Django and Astro are organised this way.
- **[Google developer documentation style guide](https://developers.google.com/style)** and **[The Good Docs Project](https://www.thegooddocsproject.dev) templates:** task-based titles, prerequisites before steps, expected output after commands, one idea per sentence.
- **Peer conventions:**
  - Astro and Vite: an installation page with package-manager tabs, "Why", troubleshooting and upgrade guides.
  - ESLint: rule pages with the reason for the rule, incorrect and correct code, and the version it was added in.
  - GitHub CLI and Docker: every command has examples.
  - Stripe: every API object has a worked request and response.
- **[GitHub community standards](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions):** `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue templates.

## Keep

- Reference generated at build time from the registry, schemas, CLI definitions and MCP server.
- YAML samples included from `examples/`, and failing samples tested against the rule their page names.
- The CLI-line check, the links validator and the tutorial's end-to-end test.
- Rule pages with a failing example, the fix and the fixed file, linked from `check` output.
- `llms.txt`, the `.md` copies, and the "For agents" pointer on each model guide.
- Exported diagrams in light and dark with a link to the live View.
- The Glossary's vocabulary and capitalisation.

## Findings

### 1. The quick start doesn't reach a result

`archidocs init` writes a `workspace.yaml` with `teams: {}` and `environments: {}`. The quick start's "Add a Project" step is one paragraph that names three files and links to the tutorial, without showing any of them. A reader who follows only the page ends at `archidocs dev` with an empty viewer.

The standard is one copy-paste path to something visible in under five minutes. The 20-minute tutorial is good and complete, but it's the second step, not the first.

### 2. Page types are mixed, so content repeats

- **Concepts carry reference.** `concepts/elements` lists the fields of each kind; `concepts/decisions` lists the frontmatter fields; `concepts/views` lists the selector keys. The same lists reappear in the guide and in the reference.
- **Guides re-explain concepts.** `add-a-service` step 2 restates field meanings; `github-pages` opens with what `archidocs build` writes before any step.
- **Measured repeats:** the Generated View id list appears in three pages; "declared under the consumer, pointing at the provider" is explained in three; the history cache in four.
- **No overview.** Concepts starts at Workspace and Projects. No page shows how the ten nouns fit in one picture, and the introduction uses Team, Project, Model, Workspace, Element and View before any of them is defined.

### 3. Guides have no common shape

- Some are numbered steps (`add-a-project`), some are topical sections (`connect-services`: "A call", "To another Project", "Through a broker"), some are explanation (`other-hosts`).
- Only 1 of 18 guides states prerequisites.
- Only 2 hand-written pages show what a command prints: the tutorial and `review/diff`.
- Titles are often nouns, not tasks: "GitHub Pages", "Dynamic Views", "PR previews", "Other hosts". Two share a name with a concept (Deployments, Dynamic Views).
- `export` sits under Review, where nobody looks for it.

### 4. Reference is complete but thin

| Reference | Gap | Evidence |
| --- | --- | --- |
| Model YAML | Fields have no description, default or constraint | 158 of 224 rows have an empty Notes column; `project-yaml` 3 of 3, `model-yaml` 108 of 134 |
| Model YAML | Shared shapes are flattened and repeated | The 8 Relationship fields are listed again under every kind and nesting level, which is most of `model-yaml`'s 134 rows |
| CLI | No examples, no exit-code table | `check` documents two flags and nothing else; exit codes appear only in its one-line description |
| CLI | How a Workspace is found isn't documented | "this folder, its `archidocs/` folder, or any folder above" exists only in an error message |
| MCP tools | 31 tools on two long pages, no example call or result | `get_element`'s output table repeats `element.id`, `element.kind` and the rest once per kind |
| MCP tools | No list of error codes | `validation_failed` and `ambiguous` are mentioned in prose only |
| Check rules | 45 rules in one flat table; no reason for the rule, message text or version added | Compare any ESLint rule page |
| Viewer | No reference for viewer URLs | "Every screen is a link" is a headline feature; `impact`, `way`, `team`, `at`, `vs` appear only in examples |

### 5. The viewer is described, never shown

The docs contain 16 exported diagrams and no screenshot of the viewer. `concepts/viewer` covers Find, the trees, the Element panel, the three Lenses, Compare, Save as View and downloads in about 550 words. The six persona questions on the introduction page each deserve a guide that shows the screen that answers them.

### 6. Front-door pages are missing

| Page | Why readers expect it |
| --- | --- |
| Installation | Requirements, npm / pnpm / npx, verifying the install, upgrading. Today it's two lines in the quick start. |
| Troubleshooting and FAQ | "No workspace.yaml found", empty viewer, missing history in CI (`fetch-depth`), port in use. Nothing exists. |
| Upgrading and versioning | What semver covers, what the Bundle `schemaVersion` and the Action's `@v1` tag promise. The Changelog is the only version page. |
| Why Archidocs | How it differs from diagrams drawn by hand, diagrams as code and a service catalog. Adopters ask this first. |
| Editor setup | The schemas ship for completion and validation, mentioned in one generated sentence. |
| Check a Workspace in CI | `check --format github` on pull requests, without publishing. |
| Modelling guidelines | How much detail, System or Service, how to name ids, when to split a Project. |
| Contributing, security, getting help | The repo has no `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` or issue templates. |

### 7. Wayfinding

- The docs home is five bullets. Peers use a card grid by intent.
- Sidebar groups have no landing pages; "Concepts" on the home page links straight to its first page.
- No Starlight components are used: no tabs, steps, cards or file trees. Every callout is a "For agents" note; none marks a prerequisite or a pitfall.
- Pages carry no "last updated" date and no note that the site documents the latest release only.

### 8. Agents setup is generic

`connect-mcp` says "Register it the way your harness takes MCP servers" and shows one `.mcp.json`. MCP server docs normally give a tab per client with the exact file and command. The research already exists in `.scratch/archidocs-v1/research/03-mcp-client-support.md`. "Harness" (6 uses) isn't a Glossary term and isn't what readers call their tool.

### 9. Voice

Accurate and consistent, but dense.

- Long link-chain sentences: the "Read tools" paragraph in `agents-and-mcp` is one sentence with six tool links.
- Terms are linked to the Glossary on first use but not explained in place, so a new reader leaves the page to keep reading.
- Spelling is British ("organisation", "colour", "data centre"). Most developer docs follow US spelling, and the docs move to it.

## Proposal

### Page tree

New pages are marked **new**; renamed pages show the old title.

- **Docs home:** a card grid by intent: try the demo, quick start, model, publish, connect an agent, look something up.
- **Get started**
  - What is Archidocs? (was Introduction)
  - Installation **new**
  - Quick start (rewritten)
  - Tutorial: Model your first system
  - Why Archidocs **new** (names no other tool)
- **Concepts**
  - How Archidocs works **new**
  - Workspace and Projects · Elements · Relationships · Teams and ownership · Deployments · Views · Revisions and history · Decisions · Agents and MCP
  - Modelling guidelines **new**
- **Guides**
  - **Model:** Add a Project · Add a Service · Connect Services · Add Deployments · Save a View · Write a Dynamic View (was Dynamic Views) · Record an ADR · Rename, move or remove · Set up your editor **new**
  - **Use the viewer** **new:** Find an Element · Trace impact and paths · See where a Service runs · Compare two Revisions · Share or save what's on screen
  - **Publish:** Publish to GitHub Pages · Publish to GitLab Pages · Publish to another host · Preview pull requests · Publish Saved View images · Check a Workspace in CI **new**
  - **Review and share:** Review changes with diff · Export diagrams
  - **Agents:** Connect an agent over MCP · Install the agent skill · Bootstrap a Project from code
- **Reference**
  - CLI · Model YAML · MCP tools · Check rules · CI · Viewer URLs **new** · Authoring guide for agents · Glossary · Changelog
- **Examples:** Big Bank · Kitchen sink
- **Help** **new:** Troubleshooting · FAQ · Upgrading and versioning · Contributing and getting help

Renamed pages keep their old URL as a redirect. Rule page URLs don't change, because released CLIs print them.

### One template per page type

| Type | Sections, in order | Rule |
| --- | --- | --- |
| Tutorial | What you'll build · Before you start · numbered steps, each with the output or a screenshot · What you learned · Next | One path, no options |
| How-to guide | One-sentence outcome · Before you start · numbered steps · Check it worked · If it didn't · With an agent · Related | Title starts with a verb. No field lists: link to the reference. |
| Concept | What it is, in two sentences · the picture · how it behaves · why it works this way · Related | No steps. No field lists. |
| Reference | Summary · syntax · every field with type, default and description · examples · errors · See also | Generated. Nothing hand-copied. |

### Quick start, rewritten

The outline, to show the intended shape:

1. **Install** (tabs: npm, pnpm, npx).
2. **Create a Workspace:** `archidocs init`.
3. **Paste three files**, shown in full with file titles: `workspace.yaml` (one Team, one Environment), `shop/project.yaml`, `shop/model.yaml` (one Person, one System, two Services, two Relationships). Included from a new `examples/quick-start/`, so they're tested like the tutorial's.
4. **Check it:** `archidocs check`, with the output.
5. **Open it:** `archidocs dev`, with a screenshot of what appears.
6. **Next:** the tutorial, publish, connect an agent.

An `archidocs init --example` flag that writes the files was considered and turned down.

### Concepts, trimmed

- Move field and selector lists to the reference and link them. Keep one YAML sample per page as illustration.
- Add a "why it works this way" section to each, from the reasoning already in the v1 tickets: why Relationships point one way, why Layout is never stored, why `superseded` is derived.
- Fold `concepts/viewer` into "How Archidocs works" and the new viewer guides.

### Reference generators

| Change | Where | Enforced by |
| --- | --- | --- |
| A description, default and constraint for every schema field. Editors show the same text on hover. | `src/schema/`, which `pnpm schemas` writes to `schemas/*.schema.json` | A test that fails on a field without a description |
| Render shared shapes once ("Common fields", "Relationship", "Link") and link to them | `website/src/reference/json-schema.ts`, `model.ts` | Row count drops; snapshot test |
| `examples` on every command, an exit-code table, a "How the Workspace is found" section | `src/cli/commands.ts`, `website/src/reference/cli.ts` | A test that fails on a command with no example. The CLI-line check already validates them. |
| One page per MCP tool with a real call and result captured from the Kitchen sink, as the landing page does. The two existing pages stay as indexes and keep their anchors. | `website/src/reference/mcp.ts` | Build fails if a capture fails |
| Render union outputs as variants, not flattened rows | `website/src/reference/json-schema.ts` | Snapshot test |
| An MCP error-code page | New `errors` list beside the tool registrations | Generated |
| Rules index grouped by area. Each rule page gains the message as printed, why the rule exists, related rules and the version it was added in. | `src/core/rules.ts` gains `why`, `since`, `related` | Type-checked: required fields |
| Viewer URL reference | Generated from the viewer's URL parsing in `viewer/src/place.ts`, which needs a declared list of its parameters first | Generated |

### Viewer guides and screenshots

Screenshots would go stale, which is the problem this product exists to fix. So generate them: a Playwright script opens the Big Bank demo build at a URL per shot, in light and dark, during the docs build, the same way diagrams are exported today. Each viewer guide answers one persona question from the introduction's table and ends with the same question over MCP.

### Style rules

Short enough to live in `website/README.md`:

- One page type per page. If a guide needs a paragraph of why, link the concept.
- Guide titles start with a verb. Concept titles are nouns.
- Explain a Glossary term in half a sentence the first time a page uses it, and link it.
- Show the output after any command whose output the reader acts on.
- Every code block that is a file carries its path as a title.
- A callout marks a prerequisite, a pitfall or an agent pointer. Nothing else.
- "Coding agent" for the reader's tool, not "harness".
- At most two links in a sentence.

### Agents

- `connect-mcp`: a tab per client with the exact file and command, then "Try it" with the expected tool call.
- Guides keep "With an agent" as their last section and the "For agents" pointer.
- No change to the two-source decision: human guides and agent topics stay separate.

### Site settings

- `lastUpdated: true`, and a line in the footer that the site documents the latest release, with the version.
- An index page per sidebar group.
- Starlight `Tabs`, `Steps`, `CardGrid` and `FileTree` where the templates call for them.

## Decisions this reopens

Each contradicts the [docs site spec](../docs-site/spec.md). All four were accepted on 2026-11-24; see [Decisions](#decisions).

| Earlier decision | Proposed | Why reopen |
| --- | --- | --- |
| "A viewer manual" is out of scope; one Concepts page explains the viewer | A "Use the viewer" guide group with generated screenshots | The primary audience in `PRODUCT.md` is viewer users, and they have one page |
| Contributor docs stay in the README and `AGENTS.md` | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and issue templates at the repo root, plus one Help page linking them | GitHub and adopters look for these files by name |
| MCP reference is `read-tools` and `write-tools` with an anchor per tool | A page per tool; the two pages stay as indexes | Examples and variant outputs don't fit 31 sections on two pages |
| The page tree in [information architecture](../docs-site/issues/02-information-architecture.md) | The tree above | Adds Help, viewer guides and front-door pages |

Unchanged: latest-only docs, the Bundle format staying internal, no blog, generated reference never committed, search by page title or heading.

## Phases

Each phase ships on its own and leaves the site consistent.

1. **First success.** Quick start rewrite with `examples/quick-start/` and an end-to-end test, Installation, docs home cards, Troubleshooting, per-client MCP tabs, site settings.
2. **One job per page.** Apply the templates to the 18 guides (retitle, prerequisites, output, redirects), trim the 10 concepts, add "How Archidocs works".
3. **Reference that explains.** Schema descriptions, shared shapes, CLI examples and exit codes, per-tool MCP pages with captures, rule fields, viewer URL reference.
4. **Viewer and adoption.** Screenshot pipeline, viewer guides, Why Archidocs, Modelling guidelines, Upgrading and versioning, Set up your editor, Check a Workspace in CI, community files.

Phase 1 is content plus one example folder. Phase 3 is mostly code in `src/` and `website/src/reference/`. Phases 2 and 3 don't depend on each other.

## Tickets

The tickets are in [issues/](issues/). Ticket 01 held the reopened decisions and the open questions, and is answered.

| # | Ticket | Phase | Blocked by |
| --- | --- | --- | --- |
| 01 | [Decide what the proposal reopens](issues/01-decisions.md) | | Done |
| 02 | [A quick start that reaches a result](issues/02-quick-start.md) | 1 | |
| 03 | [Installation page](issues/03-installation.md) | 1 | |
| 04 | [Docs home, group index pages and site settings](issues/04-home-and-wayfinding.md) | 1 | |
| 05 | [Troubleshooting and FAQ](issues/05-troubleshooting-and-faq.md) | 1 | |
| 06 | [Per-client MCP setup](issues/06-mcp-client-setup.md) | 1 | |
| 07 | [Page templates, style rules and their checks](issues/07-templates-and-style-rules.md) | 2 | |
| 08 | [Guides rewritten to the how-to template](issues/08-guides-to-template.md) | 2 | 07 |
| 09 | [Concepts trimmed, and "How Archidocs works"](issues/09-concepts-and-overview.md) | 2 | 07 |
| 10 | [Model YAML reference that explains every field](issues/10-model-yaml-reference.md) | 3 | |
| 11 | [CLI reference with examples and exit codes](issues/11-cli-reference.md) | 3 | |
| 12 | [A page per MCP tool, with a real example](issues/12-mcp-tool-pages.md) | 3 | |
| 13 | [Check rule pages that say why](issues/13-check-rule-pages.md) | 3 | |
| 14 | [Viewer URL reference](issues/14-viewer-url-reference.md) | 3 | |
| 15 | [Generated viewer screenshots](issues/15-viewer-screenshots.md) | 4 | |
| 16 | ["Use the viewer" guides](issues/16-viewer-guides.md) | 4 | 07, 15 |
| 17 | ["Why Archidocs" and Modelling guidelines](issues/17-why-and-modelling-guidelines.md) | 4 | 07 |
| 18 | ["Set up your editor" and "Check a Workspace in CI"](issues/18-editor-setup-and-check-in-ci.md) | 4 | 07 |
| 19 | [Upgrading and versioning](issues/19-upgrading-and-versioning.md) | 4 | |
| 20 | [Contributor and community files](issues/20-community-files.md) | 4 | |
| 21 | [US spelling throughout](issues/21-us-spelling.md) | 2 | 07 |
| 22 | [A moving `v1` tag for the Action and the GitLab template](issues/22-moving-v1-tag.md) | 1 | Done |

Tickets 02, 03, 04, 05, 06, 07, 10, 11, 12, 13, 14, 15, 19 and 20 can start now.

## Decisions

Answered by the maintainer on 2026-11-24 ([ticket 01](issues/01-decisions.md)).

| Question | Answer |
| --- | --- |
| Add a "Use the viewer" guide group with generated screenshots? | Yes |
| Add contributor and community files? | Yes. Security reports arrive through GitHub's private vulnerability reporting; no address is published. |
| One page per MCP tool? | Yes, with `read-tools` and `write-tools` kept as indexes |
| Accept the proposed page tree? | Yes, including the one URL move |
| US or British spelling? | US ([ticket 21](issues/21-us-spelling.md)) |
| Add `archidocs init --example`? | No. The quick start pastes three files. |
| Which MCP clients get a tab? | Claude Code, Cursor, VS Code / Copilot and Codex |
| Does "Why Archidocs" name other tools? | No |

The versioning policy was answered the same day and is in [ticket 19](issues/19-upgrading-and-versioning.md): the CLI, Model YAML, MCP tools, rule ids, viewer URLs and Node.js LTS support break only in a major release; the Bundle format carries no promise; `@v1` is a moving tag ([ticket 22](issues/22-moving-v1-tag.md)).

Still open:

- Which private channel the Code of Conduct names ([ticket 20](issues/20-community-files.md)).
- What old `#/view/…` links do once viewer URLs drop `/#/`, which the maintainer plans for a 1.x release.
