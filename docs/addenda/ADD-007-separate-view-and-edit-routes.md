# ADD-007: Separate routes for viewing and editing diagrams

| Field | Value |
|---|---|
| **Status** | Proposed |
| **Type** | Change |
| **Proposed** | 2026-11-05 by Logan Harber (drafted by Claude) |
| **Decided** | |
| **Baseline** | PRD v1.6 (with ADD-001..005) |
| **Affected IDs** | DIAG-12 (new), DIAG-07, DIAG-10, LAYOUT-01..15, LAYOUT-25, SCOPE-01, E2E-01..05, VR-01..09 |
| **PRD sections** | §2.2, §2.3, §7 |

## Context

Phase 1 opens every diagram straight into the layout editor: a toolbar of layout tools, a settings panel and an editable canvas. Most visits are for reading, and the editing controls get in the way of that. The PRD says what the viewer and editor must do, but not whether they're separate screens.

## Change

### DIAG-12 (new)

> Each diagram has a read-only view route and a separate edit route. The view shows the diagram without layout-editing controls, and the edit route provides the layout editor. — Priority: P1, Phase 1

### Routes

| Route | Purpose |
|---|---|
| `/workspaces/<key>/diagrams/<id>` | **View** (default). Links from the home page and from related-diagram navigation go here. |
| `/workspaces/<key>/diagrams/<id>/edit` | **Edit**: the current layout editor, unchanged in capability. |

### View route

- Full-width canvas. Pan, zoom, fit to view and the minimap stay (LAYOUT-10). Nodes can't be dragged, resized or aligned.
- Clicking a node or edge opens inspection in a panel that's closed by default (DIAG-07). Related-diagram links stay in view mode.
- PNG and SVG export stay available (LAYOUT-15), since sharing a diagram isn't editing.
- Diagnostics (DIAG-10) collapse to a status indicator, for example "2 problems". It expands to the full list. A stale model is still always visible.
- Animated edges play as configured (LAYOUT-25).
- An **Edit layout** button goes to the edit route. If the layout file isn't writable, the button is disabled and its tooltip gives the reason.
- External YAML changes reload the view live (RELI-01..04), the same as in the editor.

### Edit route

- Same behaviour as Phase 1: drag, align, distribute, snap, re-layout, settings, undo/redo, save, drafts, live reload with rebasing, and export.
- A **Done** control returns to the view route. If there are unsaved changes, it asks whether to save, discard or stay. The browser's leave-page warning and autosaved drafts (RELI-11) stay as they are.
- Related-diagram links open the target in view mode.

### Unchanged

- What's saved and where (`.layout.yaml`, LAYOUT-08/22/23), and SCOPE-01. Neither route creates or deletes entities.
- There's no authentication or permission model. "Edit" is a separate mode, not access control (PRD §6 still applies).

## Consequences

- No schema or file-format change, and no migration.
- **UI:** the editor component splits into a shared canvas plus view-only and edit-only chrome. The canvas covers styled nodes and edges, boundaries, live reload and export.
- **Tests:**
  - E2E-02..04 move to the edit route. E2E-01 and E2E-05, DIAG-07/09/10 and LAYOUT-10/14 run against the view route.
  - New tests cover the Edit/Done round trip and the unsaved-changes prompt.
  - The view route has no layout controls. That's SCOPE-01's check, extended to dragging.
- **Visual regression:** VR-01..08 are recaptured on the view route, which gives cleaner, chrome-free snapshots. VR-09 shows diagnostics in both modes. One extra snapshot covers the editor chrome.
- **Ticked items:** these stay ticked, but their evidence moves to the updated tests.

## Open questions

1. Should the view route show a small **legend** of shapes and colours used? This addendum leaves it out.
2. Should viewers be able to toggle edge animation locally (not saved)? This addendum says no.

## Checklist updates

To do on acceptance:

- [ ] Add DIAG-12 to `docs/checklists/02-diagrams.md` with "(added by ADD-007)"
- [ ] Note "(amended by ADD-007)" on E2E-01..05 and VR-01..09 in `docs/checklists/06-testing.md`
- [ ] Record DIAG-12 in the allocated-IDs table
- [ ] Run `scripts/prd-progress.sh --write`
