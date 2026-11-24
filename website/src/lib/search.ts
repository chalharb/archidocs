/**
 * Pagefind's ranking for the site's search. Untuned, Pagefind's length
 * normalisation (`pageLength` 0.75) let short pages that mention a tool in
 * passing, like the agent guide's topics, outrank the long MCP tool pages
 * where the tool is a heading of its own. A low `pageLength`, with identifier
 * headings weighted (src/plugins/identifier-headings.ts), keeps a rule id, a
 * CLI flag or an MCP tool name finding its reference page first
 * (website/e2e/search.spec.ts).
 */
export const PAGEFIND_RANKING = { pageLength: 0.1 } as const;
