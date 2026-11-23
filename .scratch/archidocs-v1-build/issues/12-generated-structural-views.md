# 12: Generated structural Views

Status: done
Assignee: Claude (ticket-12 session)
Blocked by: 04, 06
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

The Generated C1–C3 Views exist as data, through one shared resolver, and agents can read them.

- A core `resolveView(id)` for `c1`, `c2` (every System collapsed), `c2/<system>` and `c3/<service>` (only for Services with Components).
- Neighbours outside the focus are collapsed to the highest level that still separates them, and edges are derived. External Elements are flagged.
- MCP `list_views(kind?, element?)` and `get_view(id)` returning `{id, kind, title, nodes, edges}`.
- The `oversized-view` warning (over 150 nodes).

## Acceptance criteria

- [x] Resolver tests for each scope on the fixture, including neighbour collapsing.
- [x] `list_views(element)` returns the Views containing that Element.
- [x] A View id with an unknown scope returns `not_found`.
