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

## Not yet specified

- **Deploy pipeline details:** a preview deploy per PR, whether the site builds in CI or on Vercel, link checking, and DNS for the root domain (it's unclear what serves archidocs.dev today).
- **Drift checks:** how CI proves that generated reference pages match the code (regenerate and diff, the same way `rules:catalogue` and `schemas` do today?).
- **Search:** whether the generator's built-in search is enough, or whether it needs tuning for terms like rule ids and CLI flags.
- **Landing page copy:** the message and calls to action, once the IA and the landing prototype exist.
- **README slimming:** what stays in the README (it is the npm and GitHub front page) and what moves to the site.

## Out of scope

- **A cached copy of the docs for each release:** this is a likely future state. The destination is latest only. The generator choice should not rule it out (see the generator ticket).
- **A blog.**
- **Contributor docs:** these stay in the README and `AGENTS.md`.
