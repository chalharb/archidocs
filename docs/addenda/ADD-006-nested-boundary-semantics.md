# ADD-006: Nested boundary membership and layout coordinates

| Field | Value |
|---|---|
| **Status** | Proposed |
| **Type** | Clarification |
| **Proposed** | 2026-11-05 by Claude, during Phase 1 |
| **Decided** | |
| **Baseline** | PRD v1.6 (with ADD-001) |
| **Affected IDs** | LAYOUT-14, LAYOUT-08, LAYOUT-24 |
| **PRD sections** | §2.3, §4 |

## Context

LAYOUT-14 asks for nested boundaries and grouping, but neither the PRD nor ADD-001 says which nodes a boundary contains, or whether `.layout.yaml` coordinates of nodes inside a boundary are absolute or relative to the boundary. Both affect saved files, so they're recorded here rather than left as implementation details.

## Change

### LAYOUT-14 (clarified)

> A diagram node is drawn inside a boundary when the nearest ancestor of its entity (following `parent`) that the diagram also shows appears there as exactly one view instance. That node becomes the boundary. Ancestors the diagram doesn't show are skipped. When the nearest shown ancestor has several view instances (DIAG-09), the node isn't nested, because it's ambiguous which instance contains it.

There's no new schema: membership comes from `parent` (MODEL-10) and the diagram's node list.

### Layout coordinates (clarifies LAYOUT-08)

> Every `nodes` entry in `.layout.yaml` uses absolute canvas coordinates, including nodes inside a boundary. A boundary's `width` and `height` are saved with its position. Moving a boundary in the editor moves its contents, and the editor saves the new absolute positions of all of them.

Absolute coordinates keep collision detection (LAYOUT-24) and diffs simple, and changing `parent` in YAML doesn't change how existing saved positions are read.

### Automatic layout (LAYOUT-04, LAYOUT-24)

- ELK.js lays out boundaries as compound nodes and sizes them to fit their contents.
- During partial regeneration, a new node inside a manually placed boundary is positioned relative to that boundary's saved position. A generated node is never reported as colliding with its own boundary.

## Consequences

- No schema change and no migration (SCHEMA-10).
- If parent-relative coordinates are preferred later, that's a layout-file format change and needs a migration (SCHEMA-10).

## Checklist updates

To do on acceptance:

- [ ] Note "(clarified by ADD-006)" on LAYOUT-14 in `docs/checklists/03-layout.md`
- [ ] Run `scripts/prd-progress.sh --write`
