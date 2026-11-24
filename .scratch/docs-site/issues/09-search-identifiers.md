# Does Pagefind find rule ids and CLI flags

Type: research
Status: open
Assignee: research subagent
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

Does Starlight's Pagefind search, untuned, find identifier-heavy queries: rule ids like `unknown-field` or `via-on-sync`, partial ids (`via-on`), CLI flags like `--all-saved` and `--strict`, and MCP tool names like `upsert_element`? If not, which Pagefind settings fix it (`include_characters`, ranking weights, `data-pagefind-meta`, per-page keywords)? Answer from Pagefind's docs and, ideally, a small local test index.

## Research

Findings: branch `research/search-identifiers`, file `.scratch/docs-site/research/search-identifiers.md` (never merged).
