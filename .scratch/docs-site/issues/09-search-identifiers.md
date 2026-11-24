# Does Pagefind find rule ids and CLI flags

Type: research
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

Does Starlight's Pagefind search, untuned, find identifier-heavy queries: rule ids like `unknown-field` or `via-on-sync`, partial ids (`via-on`), CLI flags like `--all-saved` and `--strict`, and MCP tool names like `upsert_element`? If not, which Pagefind settings fix it (`include_characters`, ranking weights, `data-pagefind-meta`, per-page keywords)? Answer from Pagefind's docs and, ideally, a small local test index.

## Research

Findings: branch `research/search-identifiers`, file `.scratch/docs-site/research/search-identifiers.md` (never merged).

## Answer

**Untuned Starlight search works for every kind of identifier, so set no Pagefind options.** Tested with astro 7.4.13, `@astrojs/starlight` 0.43.1 and pagefind 1.6.0 on a 12-page test site. The right reference page ranked first for:

- **Full rule ids** (`via-on-sync`, `unknown-field`, `ancestor-descendant-relationship`).
- **Partial ids** (`via-on`, `ancestor-desc`). `via-on` correctly leaves out `via-not-broker`.
- **CLI flags** (`--all-saved`, `--strict`, `--bundle-only`). Pagefind strips the dashes.
- **snake_case MCP tool names** (`upsert_element`, `upsert_el`, `get_authoring`).

Each result links to the exact heading, e.g. `#upsert_element` or `#--all-saved`.

**Why it works:** Pagefind 1.x indexes hyphenated and snake_case words both whole and split into parts. It also boosts headings by default (h1 7.0, h2 6.0, h3 5.0, body text 1.0).

**Rule for reference pages:** every rule id, CLI flag and MCP tool name must be a **page title or a heading of its own**. That placement is what makes it rank first.

**Settings that were tried and rejected:**
- `includeCharacters: '-_'` didn't change the top result, and un-dashed queries like `all-saved` started matching unrelated pages.
- Weights, `data-pagefind-meta` and keywords aren't needed.
