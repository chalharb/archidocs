# 06: MCP read server over a checkout

Status: ready-for-agent
Blocked by: 03
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

An agent connects with `archidocs mcp` (stdio) inside a Workspace checkout and can look things up.

- Built on MCP TypeScript SDK v2 (≥ 2.4.0), with stateless tools only.
- The checkout source builds the Bundle in memory and rebuilds it on file change.
- Tools: `get_workspace_info` (source, commit, writes allowed), `search_elements` (names and ids), `get_element` (fields, Owner, parent and children, source location), `list_teams`, `list_environments`.
- Every result is `structuredContent` plus a compact Markdown text copy.
- Lists take `limit` (default 50) and return `truncated` and a total.
- Qualified ids only. Unknown ids return an `isError` result with `not_found` and suggestions.
- `viewerUrl` when a viewer base URL is configured.

Tests use an in-memory MCP client against a fixture checkout.

## Acceptance criteria

- [ ] Each tool returns structured and text output for the fixture.
- [ ] Editing a fixture file is reflected in the next call.
- [ ] An unknown id gives `not_found` with did-you-mean; a malformed call gives a protocol error.
- [ ] `limit` truncates and reports the total.
