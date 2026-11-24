# Archidocs docs site

Label: wayfinder:map

## Destination

A **spec for the Archidocs documentation site** at archidocs.dev. It locks six areas in enough detail to split into build tickets: audience and information architecture (the page tree), the site generator, which content is generated and which is hand-written, hosting and deploy, versioning, and how the site shows the live viewer. Building the site is a separate effort.

## Notes

- **Audience:** people adopting Archidocs come first: they set up a Workspace, author Projects, wire up CI and point agents at MCP. Viewer visitors (the viewer has to answer them itself) and contributors (README, `AGENTS.md`) are out of scope. Agents are a second reader of the same docs.
- **Domain:** vocabulary is in [GLOSSARY.md](../../GLOSSARY.md). Docs pages use its terms (Workspace, Project, Element, Team, Environment and so on). Call the Skill tool for `domain-modeling` if a term changes.
- **Single source of truth:** reference material is generated from the code and schemas (`schemas/`, `docs/rules.md` catalogue, CLI help, `guide/`), never copied by hand. Only guides and concepts are written by hand. This mirrors the product pitch: "diagrams that don't go stale".
- **Settled while charting:**
  - One site at **archidocs.dev** that serves both the landing page and the docs. The demos stay on `big-bank.` and `kitchen-sink.archidocs.dev`.
  - The source lives in **this repo** under `website/` and deploys on **Vercel** like `examples/*`, so a docs change ships in the same PR as the code.
  - **Latest only**: one version of the docs, labelled with the current release.
  - `docs/*.md` **move into** the site and the README slims down to link out. `guide/` stays put, because it ships in the npm package, and the site renders from it.
  - The site follows `DESIGN.md` and `assets/brand/`. Only the landing page gets a bespoke design; docs pages use the generator's theme, lightly customised.
  - A **changelog** page is generated from release-please's `CHANGELOG.md`. No blog.
- **Design skills:** use `impeccable` for the landing page prototype.
- **Tracker:** local markdown. Tickets are in `issues/`. Research findings go to a `research/<name>` branch, which is never merged.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [Which site generator fits the docs site](issues/01-site-generator.md): Astro Starlight (pinned, pre-1.0) on the repo's Vite 8 + React 19 stack; Pagefind search, community llms.txt plugins, static deploy; Fumadocs runner-up.
- [What is the docs site's page tree](issues/02-information-architecture.md): five groups (Start here, Concepts, Guides, Reference, Examples) under `/docs/`, landing at `/`; a page per CLI command, Model file and check rule; agent guide published as-is under Reference.
- [How docs pages show diagrams and the live viewer](issues/03-diagrams-in-docs.md): a static `archidocs export` SVG plus an "Open in the live viewer" deep link to the demo; no embedded viewer (cramped at docs width).
- [How the docs site serves agents](issues/04-agents-as-readers.md): same pages for humans and agents, plus `llms.txt` / `-full` / `-small` and a `.md` copy per page; `llms.txt` points agents to `archidocs guide` / MCP for their installed version; human Guides and agent topics stay separate, cross-linked.
- [Which content is generated and which is hand-written](issues/05-content-sources.md): reference pages built at site-build time from the rule registry, JSON Schemas (adds an ADR frontmatter page), new structured CLI definitions, MCP `listTools`, `guide/`, `GLOSSARY.md`, `CHANGELOG.md` and `examples/*` exports; never committed. `docs/rules.md` deleted; `docs/publishing.md` split into Publish guides.
- [Does Pagefind find rule ids and CLI flags](issues/09-search-identifiers.md): yes, untuned, for full and partial rule ids, `--flags` and snake_case tool names, as long as each is a page title or its own heading; no Pagefind settings.
- [What the landing page looks like](issues/06-landing-page.md): Twin screens: one real question answered side by side by an agent over MCP and by the viewer; primary action opens the Big Bank demo; direction contract in `.impeccable/surfaces/website-src-pages-index-astro.md`.
- [How the site is built and deployed](issues/07-build-and-deploy.md): the failing root Vercel project becomes the docs site (root `website/`, builds on Vercel); previews on every PR and push, production only from release tags; apex + www DNS-only on Cloudflare; export gets a label option (`Big Bank · v1.2.0`).
- [How hand-written pages are kept correct](issues/08-hand-written-correctness.md): internal links fail the build; external links checked weekly; YAML samples included from `examples/` (failure samples tested); `archidocs` command lines parsed against the CLI definitions; tutorial gets an end-to-end CI test.
- [What the README keeps](issues/10-readme-cut.md): ~70 lines: pitch, Why, Quick start, Examples, Development, License; Model, CLI, Publishing and Agents become a line plus a site link; hand-written but CLI-checked; cut ships with the first site deploy.

## Not yet specified

<!-- everything in scope is now ticketed; the landing page copy is part of the landing page ticket -->


## Out of scope

- **A cached copy of the docs for each release:** this is a likely future state. The destination is latest only. The generator choice should not rule it out (see the generator ticket).
- **A blog.**
- **Contributor docs:** these stay in the README and `AGENTS.md`.
