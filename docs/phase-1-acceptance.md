# Phase 1 — acceptance

**Exit criterion (PRD §11):** a user can visually arrange YAML-defined
architecture diagrams without modifying the canonical architecture model.

Effective requirements: baseline PRD + ADD-001..005. Nested-boundary semantics
follow [ADD-006](addenda/ADD-006-nested-boundary-semantics.md), which is
**Proposed** and awaiting a decision. Per-item evidence is in the
[checklists](checklists/README.md).

## What a user can do

Open any diagram from the home page (`/workspaces/<key>/diagrams/<id>`) and:

- See C4 context, container and component, network, deployment and custom diagrams with LikeC4-style nodes: shapes and colours come from `style` on types and entities (ADD-004). Nested boundaries are drawn from `parent` (LAYOUT-14).
- Inspect a node or edge and jump to other diagrams that show the same entity (DIAG-07).
- Drag, multi-select (Shift, Ctrl or Cmd), align, distribute and snap to a configurable grid; undo and redo every step (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y).
- Change direction, node and layer spacing, the default edge style and animation, then **Re-layout all** with ELK. Override style and animation per edge.
- **Save layout** (Ctrl/Cmd+S) to the diagram's `.layout.yaml`. Only presentation is written; canonical YAML is never touched (LAYOUT-22).
- Edit YAML in another editor: the open diagram reloads, keeping unsaved layout edits on top (RELI-01..04). Invalid edits show the last valid model with diagnostics (DIAG-10).
- Export the whole diagram as PNG or SVG, always static (LAYOUT-15, LAYOUT-25).
- Recover autosaved drafts after a failed save or a closed tab (RELI-11).

Entities and relationships can't be created or deleted on the canvas (SCOPE-01).

## How it's verified

| Area                                                                     | Tests                                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Styles, ELK layout, partial regeneration, determinism                    | `src/domain/styles.test.ts`, `src/domain/layout/elk.test.ts`, `src/domain/layout/layout.test.ts`           |
| Editor logic (move, align, distribute, snap, undo, save payload, rebase) | `src/editor/*.test.ts`                                                                                     |
| Components (editor, toolbar, settings, inspectors, nodes, edges, export) | `src/components/diagram/*.test.tsx`                                                                        |
| Change events API                                                        | `src/server/http/handlers.integration.test.ts`                                                             |
| E2E-01..05, DIAG-07/09/10, LAYOUT-10/14/25, SCOPE-01, axe                | `tests/e2e/editor.spec.ts`                                                                                 |
| Visual regression VR-01..09                                              | `tests/e2e/visual.spec.ts` (Chromium/darwin baselines)                                                     |
| BENCH-03/04/06, rendering budgets                                        | `tests/integration/performance.test.ts`, `tests/e2e/performance.spec.ts`, [performance.md](performance.md) |

The Playwright server serves four workspaces: the read-only sample (`acme`),
a fresh writable copy of it (`scratch`, recreated by
`scripts/e2e-workspaces.ts`), the visual fixture (`tests/fixtures/visual`) and
the generated medium benchmark workspace (`large`).

## Known limits

- Visual baselines exist only for Chromium on macOS. A Linux CI runner needs its own baselines (GitHub CI is deferred by ADD-003).
- Icons and per-diagram style overrides are out of scope (ADD-004).
- DIAG-06 (custom diagrams as a feature) is Phase 3. Custom diagrams already render like any other type.
