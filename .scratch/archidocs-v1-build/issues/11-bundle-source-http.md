# 11: Bundle source and HTTP transport

Status: done
Assignee: Claude
Blocked by: 06
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

People without a checkout can query a published Bundle, and HTTP clients can connect.

- `archidocs mcp --bundle <url|path>`: read-only. It re-checks the source at most every 60 s, using `If-None-Match`/`If-Modified-Since` when the host gives an ETag or Last-Modified.
- Write tools against a Bundle source return `read_only`. An unreachable source returns `source_unavailable`.
- `archidocs mcp --http` serves Streamable HTTP bound to localhost. Write tools are off unless `--allow-writes` is passed.
- `get_workspace_info` reports the source and whether writes are allowed.

## Acceptance criteria

- [x] An in-memory client test against a fixture Bundle served by a local HTTP server picks up a changed ETag.
- [x] Writes return `read_only` from a Bundle source, and over HTTP without `--allow-writes`.
- [x] The HTTP server refuses non-localhost binds.

## Comments

- `--bundle` takes a Bundle file (URL or path) or the site/folder holding `workspace.bundle.json`. Reading `bundles/index.json` from a site root, for `at` and history tools, is left to the history tickets (23–25); the Bundle file itself is what's re-checked every 60 s here.
- A path source is re-checked on the same 60 s rule, by mtime and size.
- `check` is registered as the first write tool, behind the shared gate in `src/mcp/server.ts` (`write: true` on `tool(...)`): it returns `read_only` from a Bundle source, and over HTTP without `--allow-writes`. The checkout source now reports `writesAllowed: true`, so ticket 09's write tools should register with `write: true` rather than adding their own gate.
- HTTP serves `/mcp` with the SDK's `createMcpHandler` (stateless, one server instance per request), and refuses requests whose Host or Origin isn't localhost (DNS rebinding). Default port 3737.
