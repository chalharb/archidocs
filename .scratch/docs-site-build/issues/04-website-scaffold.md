# 04: Website scaffold and generated reference

Status: done
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

- [x] `pnpm docs:build` builds with no network beyond package installs, and no generated page is committed.
- [x] Every rule in the registry has a page, and searching a rule id, `--all-saved` or `upsert_element` returns its page first (Pagefind test over the built index).
- [x] `llms.txt`, `llms-full.txt` and `llms-small.txt` and a `.md` copy of a sample page exist as static files in `dist`.
- [x] A broken internal link, or an unknown flag in an `archidocs` line, fails the build (fixture test).
- [x] Diagrams switch with Starlight's theme toggle (Playwright).

## Comments

### Build notes (2026-11-23)

What later tickets need to know, and where the build departs from the plan:

- **Layout:** `website/` is a pnpm workspace package (`pnpm-workspace.yaml`). Generated pages come from `website/src/reference/*` through one loader (`src/reference/loader.ts`) that adds them to Starlight's `docs` collection; nothing is written to disk. Each generated page gets a virtual `filePath` so the sidebar groups it and the links validator checks its links.
- **Intros for generated pages (ticket 06):** Markdown at `website/src/intros/<path under docs/>.md`, e.g. `src/intros/reference/model/model-yaml.md`, is put before the generated body. No file exists yet.
- **Placeholders (ticket 06):** every hand-written page in the tree exists under `website/src/content/docs/docs/` as a one-line placeholder. The Examples pages already use `<Diagram view="<example>/<project>:<view>" alt="…">`.
- **Landing page (ticket 07):** `website/src/pages/index.astro` is a placeholder. `@astrojs/react` isn't installed yet; add it when an island needs it.
- **Search:** untuned Pagefind did not rank the long MCP tool pages first for tool names (the agent guide's short topics won). The site sets `pagefind.ranking.pageLength: 0.1` (`src/lib/search.ts`) and gives identifier headings (`--flag`, `snake_case`) `data-pagefind-weight="10"` (`src/plugins/identifier-headings.ts`). `website/e2e/search.spec.ts` checks every rule id, every MCP tool and every flag only one command takes. Flags that are plain words a guide is titled with (`--preview`, `--skill`, `--bundle`) and the `check` tool (same name as the command) are left out on purpose.
- **Flag headings** are code spans (`` ### `--all-saved` ``), because smart punctuation turns a bare `--` into a dash.
- **`llms.txt`:** `starlight-llms-txt` doesn't list every page in `llms.txt`; it links `llms-full.txt`, `llms-small.txt` and one set per part of the docs (Start here, Concepts, Guides, CLI, Model YAML, MCP, rules, agent guide) under `/_llms-txt/`. `.md` copies come from `starlight-llm-actions` as static files; `public/_headers` serves them as UTF-8.
- **MCP split:** read and write follow each tool's `readOnlyHint`. The `check` tool is registered as a write tool (it needs a checkout), so it is on the write tools page. The server lists 31 tools, not 32.
- **CLI-line check:** a Sätteri mdast plugin (`src/plugins/command-lines.ts`) checks shell code blocks (`sh`, `bash`, `shell`, `zsh`, `console`) line by line and inline code that is a whole `archidocs …` command, on hand-written and generated pages. `text` blocks (synopses) aren't checked. `website/test/command-lines.test.ts` also runs it over the README.
- **Deploys:** `.github/workflows/docs.yml` makes Previews (`pr-<n>`, `main`); the `docs` job in `publish.yml` runs `wrangler deploy` from the release tag. The first release after this merges deploys production and creates the `archidocs.dev` and `www` Custom Domains, with placeholder pages unless 06 has landed. The `www` redirect rule stays with ticket 05.
- **Tests:** `pnpm docs:test` (vitest in `website/`: generators, a full build, and fixture builds that must fail on a broken link, a broken anchor, an unknown flag and an unknown command) runs in the new CI `docs` job; `pnpm test:e2e` now also builds and serves the site for `website/e2e`.

