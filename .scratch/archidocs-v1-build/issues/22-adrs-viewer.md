# 22: ADRs in the viewer

Status: done
Assignee: Claude (session epic-nightingale-c60076)
Blocked by: 15, 21
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

People read an Element's decisions in the viewer.

- The Element panel's ADRs tab: the same list as `list_adrs(element)`, with superseded ADRs marked.
- An ADR reader showing status, effective status, date, links (which open the linked Elements and Views) and the rendered body.

## Acceptance criteria

- [x] Playwright: open an Element, open an ADR, follow a link to a Saved View.
- [x] A superseded ADR shows its effective status and a link to its successor.
