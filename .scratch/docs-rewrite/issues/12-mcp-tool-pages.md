# 12: A page per MCP tool, with a real example

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The 31 tools sit on two long pages with no example call, and outputs that are unions render as flattened rows (`get_element` lists `element.id` once per kind).

- **Pages:** one per tool at `/docs/reference/mcp/<tool>/`, generated in `website/src/reference/mcp.ts`: title, description, input, output, an example, errors.
- **Example:** the build calls each tool over the Kitchen sink, as the landing page does for `get_impact`, and shows the arguments and the result. The arguments come from one small map of tool name to example input. Write tools are called with `dry_run: true`.
- **Variants:** render a union output as one table per variant ("When `kind` is `service`"), not as repeated rows.
- **Indexes:** `read-tools` and `write-tools` stay, as a table of tools with a line on each. Each keeps a heading per tool so existing `#tool` anchors still resolve.
- **Links:** `toolPath` returns the tool's page, and hand-written links follow.
- **Error codes:** a generated `reference/mcp/errors` page listing each code (`validation_failed`, `ambiguous` and the rest) with what it means and what to do. If the codes have no single list in `src/mcp/`, make one and use it there.

## Acceptance criteria

- [x] Every tool has a page with an example call and its real result.
- [x] The build fails when a tool has no example input or its example returns an error.
- [x] No output table repeats a field name.
- [x] Old `read-tools/#<tool>` and `write-tools/#<tool>` links still resolve.
- [x] `website/e2e/search.spec.ts` finds each tool's own page first.
- [x] The error-code page lists every code the server can return, checked by a test.

## Notes

- `toolPath`, the landing page, the reference index, the concept pages and the introduction link the tool pages. The guides' `read-tools/#<tool>` and `write-tools/#<tool>` links still resolve; they move to `/docs/reference/mcp/<tool>/` once ticket 08's rewrite of the guides lands.
- CI's `docs` and `e2e` jobs check out the full history (`fetch-depth: 0`), since the `get_changes` and `list_history` examples read it.
