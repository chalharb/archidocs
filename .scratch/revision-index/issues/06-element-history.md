# 06: The viewer's Element history through `scopeMatcher`

Status: done
Blocked by: 03
Spec: [Revision index](../spec.md)

## What to build

The viewer finds the Revisions that touched an Element the way MCP's `list_history` does. PR title: `refactor(viewer): ...`. No behaviour change.

- Add `touching(revisions, matches)` to `src/revisions/`: the Revisions whose `changedIds` satisfy `matches`, newest first.
- `src/mcp/server.ts:770-771` (`list_history`): use it with `scopeMatcher`.
- `viewer/src/ElementPanel.tsx:283-292`: replace the hand-written walk over `workspace.children` with `scopeMatcher({ kind: "element", id }, [bundle])` from core, where `bundle` is the Bundle the panel shows, and `touching`. Delete `Timeline.touching` (`viewer/src/revisions.ts:70-72`).
- `scopeMatcher` stays in `src/core/history-scope.ts`.

## Docs

None. The History tab (`website/src/content/docs/docs/guides/viewer/compare-two-revisions.mdx:30`) behaves the same.

## Tests

- A unit test for `touching` in `test/revisions/`.
- `e2e/history.spec.ts` "Element History tab" passes unchanged.
- `test/mcp/history.test.ts` "narrows to the Revisions that touched a scope" passes unchanged.
