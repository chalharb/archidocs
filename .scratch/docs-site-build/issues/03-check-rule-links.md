# 03: Rule links in check output

Status: done
Blocked by: None (can start immediately)
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Link each issue's rule to `https://archidocs.dev/docs/reference/rules/<rule-id>/` ([check links](../../docs-site/issues/11-check-links-to-rules.md)). The links are always on.

- **`--format json`** and MCP `validation_failed` issues gain a `docs` field.
- **`--format text`** ends with a "Rule docs" footer listing each distinct rule's URL once.
- **`--format github`** annotation messages end with `See <url>`.
- Add a `removed` list beside the rule registry (rule id, version removed, what replaced it), empty today. The site generates stub pages from it.
- The base URL lives in one constant.

## Acceptance criteria

- [x] Each format shows the link as described (format tests).
- [x] MCP `validation_failed` issues carry `docs` (MCP write-tool test).
- [x] The JSON output schema and any snapshot tests are updated.
- [x] A test fails if a rule id appears in both the registry and the `removed` list.
