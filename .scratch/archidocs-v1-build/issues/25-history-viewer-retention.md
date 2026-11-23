# 25: History in the viewer and site retention

Status: done
Assignee: Claude (ticket-25 session)
Blocked by: 15, 23
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

The published site carries history, and people explore it in the viewer.

- `build --out` writes `bundles/<sha>.json` and `bundles/index.json`. Each entry is `{sha, date, subject, author, tags, counts, changedIds, bundle}`.
- Retention: `--keep <n|all>` (default 200), plus every tagged Revision. Dropped entries carry `bundle: false`.
- Viewer:
  - `at` and `vs` in the URL;
  - an `at` banner with "Back to latest";
  - a Compare Lens over the union layout: added nodes and edges get a green `+`, removed ones are red dashed ghosts, changed ones get an amber dot;
  - a Changes list that focuses a Change on click, and before/after fields in the panel;
  - a Revision timeline with tags marked;
  - an Element History tab.
- A View that exists on only one side still opens.

## Acceptance criteria

- [x] CLI tests cover retention with tags and `bundle: false` entries.
- [x] Playwright covers Compare marks, a removed System's C2 opening, and the History tab opening Compare.
- [x] `at` on a dropped Revision shows `history_unavailable` guidance.
