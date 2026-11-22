# 11: Bundle source and HTTP transport

Status: ready-for-agent
Blocked by: 06
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

People without a checkout can query a published Bundle, and HTTP clients can connect.

- `archidocs mcp --bundle <url|path>`: read-only. It re-checks the source at most every 60 s, using `If-None-Match`/`If-Modified-Since` when the host gives an ETag or Last-Modified.
- Write tools against a Bundle source return `read_only`. An unreachable source returns `source_unavailable`.
- `archidocs mcp --http` serves Streamable HTTP bound to localhost. Write tools are off unless `--allow-writes` is passed.
- `get_workspace_info` reports the source and whether writes are allowed.

## Acceptance criteria

- [ ] An in-memory client test against a fixture Bundle served by a local HTTP server picks up a changed ETag.
- [ ] Writes return `read_only` from a Bundle source, and over HTTP without `--allow-writes`.
- [ ] The HTTP server refuses non-localhost binds.
