# MCP tool surface

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 03, 05
Map: [Archidocs v1](../map.md)

## Question

Which MCP tools does the server expose? Map each persona question to a query tool (path between two Elements, Upstream/Downstream impact, Team ownership, Deployments, URL by Environment, ADRs linked to an Element and the ADR timeline), and define the validated write tools agents use to author the Model. Settle the input and output shapes, how the server switches between a local checkout and a Workspace Bundle URL, and how errors are reported.

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md); no terms changed. Builds on [MCP client support](03-mcp-client-support.md): stateless tools only, `structuredContent` plus a text copy, stdio then Streamable HTTP.

**Shape**
- **Specific tools, not a query language.** About 10 read tools, each named after the question it answers, plus `search_elements` (matches names, ids and URLs) and `get_element`.
- **Qualified ids only** (`project:id`) in every input and output; there is no "current Project". Unknown ids return did-you-mean suggestions. Write tools take a `project` argument and accept bare ids inside it, as YAML does.
- **Results:** `structuredContent` is the full typed result. The text copy is compact Markdown (a one-line summary, then bullets) written for the model. Every list takes `limit` (default 50) and returns `truncated` and a total count. If a viewer base URL is configured, results carry `viewerUrl` links.

**Source**
- One source per server process, set at startup: a local checkout (`archidocs mcp` in the repo; the Bundle is built in memory and rebuilt on file change), or a Bundle file or URL (`archidocs mcp --bundle <url|path>`, re-fetched when its ETag changes). No switching at runtime.
- `get_workspace_info` reports the source, commit and whether writes are allowed.
- **Transports:** stdio, and `archidocs mcp --http` bound to localhost with no auth. Write tools are off over HTTP unless `--allow-writes` is passed. An always-on remote endpoint stays in the map's Hosted remote MCP fog.

**Read tools, by persona**
- **Enterprise Architect:** `find_paths(from, to, max_hops=4)`: the direct Relationships between the two Elements both ways, declared and derived (each derived edge lists the declared Relationships beneath it), and the shortest paths up to `max_hops` with each hop's Relationships. Compared at the levels of the two Elements given. A `via` broker counts as a hop.
- **Solutions Architect / QA Tester:** `get_deployments(service, environment?)`: per Deployment, the Environment, the full Deployment Target chain, `url` and `endpoints`. No separate URL tool; `search_elements` does the reverse lookup from a URL.
- **Developer:** `list_owned(team, kind?)`: Elements and Deployment Targets the Team owns, grouped by kind, each with counts of Upstream and Downstream Teams. Also `list_teams` and `list_environments`.
- **Product Owner:** `get_impact(id, direction: upstream|downstream|both, max_depth?)`: the transitive set grouped by distance, each Element's Owner, and the Relationships that carry the impact. Includes descendants' Relationships. Logical Model only; no impact per Environment in v1. Depth unlimited by default, still capped by `limit`.
- **Technical resource:** `list_adrs(element?, status?)` and `get_adr(id)`; fields and numbering are left to [ADR format and linking](11-adr-format.md). History tools are left to [History UX](15-history-ux.md); the argument name `at` (a commit) is reserved on read tools for it.
- **Element detail:** `get_element(id)`: fields, Owner, parent and children, declared Relationships in and out, derived edges, Deployments with URLs, linked ADRs, source file:line, `viewerUrl`.
- **Views:** no render tool in v1; every persona question is answered by the graph tools. `list_views` and `get_view` (a View's query result as nodes and edges) are left to [View kinds and definitions](10-view-definitions.md).

**Write tools** (local checkout only)
- `upsert_element(project, kind, id, fields, parent?)`, `remove_element`, `upsert_relationship(project, from, to, fields, id?)`, `remove_relationship`, `upsert_target`, `remove_target`, `upsert_deployment`, `remove_deployment`, `upsert_team` and `upsert_environment` (these write `workspace.yaml`), `propose_adr(project, title, elements, body)` (writes an ADR with status Proposed), and `check` (validates what is on disk).
- **Every write** edits the YAML in place, keeping comments and formatting. It re-reads the files it touches, checks the whole Workspace with the change applied, refuses if the change introduces any error, and returns the diff. Every write takes `dry_run`. No locking or version token in v1.
- **Placement:** a new Element goes into its parent's file; a new top-level Element goes into an optional `file` argument, else `<project>/model.yaml`.
- **Relationship identity:** `(from, to)` plus `id` if given. Several Relationships on a pair with no `id` given returns `ambiguous` with each candidate's file:line.
- **Removal:** refused while anything still references the item, with the list of references; no cascade.
- **No git:** the server never commits or opens PRs; the harness or the human does.
- Coding agents may also edit YAML with their own file tools and call `check`.

**Errors**
- Tool results with `isError: true`; protocol errors only for malformed calls. `structuredContent` is `{code, message, suggestions?, issues?}`.
- `code` is one of `not_found`, `ambiguous`, `invalid_input`, `validation_failed`, `read_only`, `source_unavailable`.
- `issues` are `{file, line, rule, message}` records, the same as `archidocs check` output; the rule ids are left to [archidocs check](16-archidocs-check.md).
