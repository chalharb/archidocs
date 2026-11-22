# 24: History in MCP

Status: ready-for-agent
Blocked by: 11, 23
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Agents answer "what changed?" and query the past.

- `at` (a ref or a date) on every read tool. A checkout builds the Bundle on demand; a Bundle site loads `bundles/<sha>.json`.
- `get_changes(from, to?, scope?, kinds?, limit)`, where `scope` is an Element (with its descendants), a Team or a Project.
- `list_history(scope?, since?, until?, limit)`, read from the index's changed ids.
- `history_unavailable` for a Bundle that can't be had, including index entries with `bundle: false`.

## Acceptance criteria

- [ ] In-memory client tests over both a checkout and a fixture site.
- [ ] `list_history` never diffs Bundles on the fly; it reads the index only.
- [ ] Write tools reject `at`.
