/**
 * The error codes a tool result can carry in `structuredContent.code`, each
 * with what it means and what the caller should do. The server types its
 * failures with these codes, and the docs list them on the MCP error page.
 */
export const ERROR_CODES = {
  invalid_input: {
    meaning: "The arguments don't fit the tool's input: a field is missing, has the wrong type or isn't a valid id, or a write tool was given `at`.",
    action: "Read `message`, which names the field, and call again with corrected arguments.",
  },
  not_found: {
    meaning: "An id, a Project, a View, a Deployment or a point in history (`at`, `from`, `since`) names nothing in the Model.",
    action: "Use one of `suggestions` if there are any. Otherwise find the id with `search_elements`, `list_views` or `list_history`.",
  },
  ambiguous: {
    meaning: "A name matches more than one thing: a history `scope` that is both a Project and an Element, or a write that could mean more than one Relationship or Deployment.",
    action: "Narrow the call: pass `scope_kind`, or the Relationship's `id`. `suggestions` lists the candidates when there are any.",
  },
  validation_failed: {
    meaning: "A write would add a check error, or remove something still referenced. Nothing was written.",
    action: "Fix what `issues` or `references` lists, each issue with a link to its rule's page, then write again.",
  },
  read_only: {
    meaning: "A write tool was called on a server that can't write: one reading a published Workspace Bundle, or one over HTTP started without `--allow-writes`.",
    action: "Run `archidocs mcp` over a Workspace checkout, and add `--allow-writes` over HTTP.",
  },
  source_unavailable: {
    meaning: "The server could not read the Workspace or the Workspace Bundle, or could not write the checkout.",
    action: "Check that the folder or URL the server was started with exists and is readable, then call again: each call tries anew.",
  },
  history_unavailable: {
    meaning: "The call needs the Model's history (`at`, `get_changes`, `list_history`), and the source has none: no git repository, or a published site without a Revision index.",
    action: "Run the server over a git checkout with its full history, or publish the site with its Revisions.",
  },
} as const satisfies Record<string, { meaning: string; action: string }>;

/** A code a failed tool result carries. */
export type ErrorCode = keyof typeof ERROR_CODES;
