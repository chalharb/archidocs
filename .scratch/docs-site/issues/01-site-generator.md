# Which site generator fits the docs site

Type: research
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

Which static site generator should build archidocs.dev? Compare Astro Starlight, VitePress, Docusaurus and Fumadocs on these points:

1. Generating reference pages at build time from repo files: JSON Schemas in `schemas/`, the rule catalogue (`docs/rules.md`, `scripts/rule-catalogue.ts`), CLI help, Markdown read from outside the site folder (`guide/`), and `CHANGELOG.md`.
2. Built-in local search quality (e.g. Pagefind) for identifier-heavy content such as rule ids and CLI flags.
3. Support for agents as readers: `llms.txt`, a raw Markdown copy of each page, and plugins that already exist for this.
4. Embedding React components and static SVGs, and how well it gets along with the repo's Vite 8, React 19 and pnpm toolchain.
5. A bespoke landing page next to themed docs pages.
6. Deploying as a static site on Vercel from a `website/` subfolder of a pnpm repo.
7. A path to versioned docs per release later (out of scope now, but don't rule it out).

Recommend one, with the runner-up and the reason it lost.

## Research

Findings: branch `research/site-generator`, file `.scratch/docs-site/research/site-generator.md` (never merged).

## Answer

**Use Astro Starlight** (`@astrojs/starlight` 0.43.1 on `astro` 7.4.13, as of 2026-11-23). Pin the version, because Starlight is still pre-1.0.

- **Toolchain:** it's the only candidate on the repo's own stack. Astro 7 runs on Vite ^8.3.8, and `@astrojs/react` accepts React 19 as islands in MDX.
- **Generated reference:** custom content-collection loaders (`store.set()` + `renderMarkdown()`) cover the schemas, rules, CLI help, `guide/` and `CHANGELOG.md`.
- **Search:** Pagefind is on by default and splits hyphenated words, so kebab-case rule ids match either way.
- **Agents:** `starlight-llms-txt` writes `llms.txt`, `llms-full.txt` and `llms-small.txt`. `starlight-llm-actions` adds a `.md` copy per page. Both are community plugins, not core.
- **Deploy and versioning:** it builds to a static `dist`, so it deploys like `examples/*`. Versioning later is possible through the `starlight-versions` plugin (early) or one Vercel deployment per release tag.

**Runner-up: Fumadocs.** It has the best built-in agent support, but it's built on Next.js, and a static export loses its search server and its `.md` rewrites. **Docusaurus** has no built-in local search and doesn't build with Vite. **VitePress** can't embed React components, and its stable release is still on Vite 5.

**Risks to check in a prototype:**
- Reading `guide/` from outside `website/`; a custom loader sidesteps this.
- Pagefind results for rule ids and CLI flags.
- Whether `starlight-llm-actions` writes `.md` routes as static files.
