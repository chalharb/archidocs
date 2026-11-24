# 04: Website scaffold and generated reference

Status: ready-for-agent
Blocked by: 01, 02, 03
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

`website/`: an Astro Starlight site (versions pinned, per [site generator](../../docs-site/issues/01-site-generator.md)) with the page tree and every generated page from the spec. It also gets the agent outputs, links validation, and the diagram swap.

- **Site shape:** the sidebar groups and `/docs/` URL scheme from [page tree](../../docs-site/issues/02-information-architecture.md). Hand-written pages are placeholders here; ticket 06 writes them.
- **Content loaders** (never written to disk):
  - rules: a page each, an index, and stubs from the `removed` list
  - Model YAML: schema field tables, `model.schema.json` split by top-level key, plus the ADR frontmatter page
  - CLI: from the 01 definitions
  - MCP: an in-process `listTools` split into read and write tools
  - `guide/` and `GLOSSARY.md`, rendered as they are with links rewritten
  - `CHANGELOG.md`, or a pointer to GitHub Releases until it exists
  - the `action.yml` inputs table
- **Diagrams:**
  - Export every `examples/*` Saved View in light and dark with `--label "<Example> · v<version>"`.
  - A `<Diagram>` component shows the image for Starlight's `[data-theme]`, plus an "Open in the live viewer" link ([diagrams](../../docs-site/issues/03-diagrams-in-docs.md)).
- **Agents:** `starlight-llms-txt` (`llms.txt` with full and small versions; the small one leaves out Examples and the Changelog; the header points agents to `archidocs guide` and MCP). `starlight-llm-actions` for `.md` copies; if the build shows the copies aren't static files, a hand-written endpoint returning `entry.body` replaces it ([agents](../../docs-site/issues/04-agents-as-readers.md)).
- **Checks:** `starlight-links-validator` fails the build on a broken internal link. A remark step parses every `archidocs …` line with 01's `parseCommandLine`.
- **Workers config:** `website/wrangler.jsonc` in the `examples/*` pattern (Worker `archidocs-docs`, `assets.directory: ./dist`, Custom Domains `archidocs.dev` and `www.archidocs.dev`, `workers_dev: false`, `preview_urls: true`).
- **Deploy workflow:** build and deploy the site from GitHub Actions like `.github/workflows/demos.yml`: a Preview per PR (`pr-<n>`) and for `main`, and a production `wrangler deploy` from the release tag in `publish.yml`.
- **Commands:** `pnpm docs:dev` and `pnpm docs:build` at the repo root.

## Acceptance criteria

- [ ] `pnpm docs:build` builds with no network beyond package installs, and no generated page is committed.
- [ ] Every rule in the registry has a page, and searching a rule id, `--all-saved` or `upsert_element` returns its page first (Pagefind test over the built index).
- [ ] `llms.txt`, `llms-full.txt` and `llms-small.txt` and a `.md` copy of a sample page exist as static files in `dist`.
- [ ] A broken internal link, or an unknown flag in an `archidocs` line, fails the build (fixture test).
- [ ] Diagrams switch with Starlight's theme toggle (Playwright).
