# 02: `list_gaps` and `archidocs gaps`

Status: done
Blocked by: None (can start immediately)
Spec: [Agent skills](../spec.md)

## What to build

The fill-gaps scan as a tool, replacing the jq script in `guide/topics/fill-gaps.md`. PR title: `feat(gaps): ...`.

- `src/core/gaps.ts`: a pure function over the loaded Model returning `Gap[]` = `{project, owner, item: {kind: "element" | "relationship" | "deployment", id}, missing: GapName[]}`, `GapName` being `description | technology | repository | deployments | api-docs | channel | url`. The rules are the "What counts as a gap" table and the jq query in `guide/topics/fill-gaps.md`, exactly: a Service "you run" is `kind: service`, not `external`, `type: app`; "called" means a Relationship to it from a non-Person; API docs match `api|openapi|swagger` case-insensitively in a `links` label or a Deployment `endpoints` name.
- Optional filters `project` and `owner`.
- MCP: `list_gaps(project?, owner?)`, read-only, described from the table.
- CLI: `archidocs gaps [--project <id>] [--owner <team>] [--json]`. Default output is the jq script's Markdown: `## <project>`, `### <owner>`, `- <kind> <id>: <missing, …>` (relationships as `relationship <from> -> <to>`, deployments as `deployment <service> in <env> on <target>`). Exit 0 with or without gaps; the check-errors exit code when the Workspace fails `check`, as `build` does. Add it to `commands.ts` with examples.
- Gaps stay out of `check`.

## Tests

- One case per row of the gap table, including: an external Service has no `repository` gap; a Service called only by a Person has no `api-docs` gap; a sync Relationship has no `channel` gap.
- Filters; Markdown and `--json` output; exit codes.
- The CLI output for a fixture matches the jq script's output on the same Bundle (run once while writing the test, then pin the expected text).

## Acceptance criteria

- [x] `list_gaps` and `archidocs gaps` return the same gaps.
- [x] Every row of the gap table has a test.
- [x] Docs reference for the CLI and MCP tool is updated (`website/src/reference`).
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [x] This ticket's `Status:` is set to `done` in the same PR.
