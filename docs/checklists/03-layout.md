# Layout Editor and Presentation Persistence

Source: PRD §2.3, §4. Conventions: [checklists/README.md](README.md).

## Interactive layout editor (§2.3)

- [x] **LAYOUT-01** `P0` `Phase 1` — Drag and reposition existing nodes — ✅ tests/e2e/editor.spec.ts › E2E-02 (3765da0)
- [x] **LAYOUT-02** `P0` `Phase 1` — Align and distribute selected nodes — ✅ tests/e2e/editor.spec.ts › E2E-02 align, src/editor/geometry.test.ts, src/editor/state.test.ts (3765da0, 02f134d)
- [x] **LAYOUT-03** `P0` `Phase 1` — Configurable grid snapping — ✅ tests/e2e/editor.spec.ts › E2E-02 (positions on the 20px grid), src/editor/geometry.test.ts, settings-panel.test.tsx (3765da0, 58feec7)
- [x] **LAYOUT-04** `P0` `Phase 1` — Automatic layout using ELK.js — ✅ src/domain/layout/elk.test.ts (b24fe50)
- [x] **LAYOUT-05** `P0` `Phase 1` — UP, DOWN, LEFT, RIGHT orientation — ✅ src/domain/layout/elk.test.ts › orients layers, tests/e2e/editor.spec.ts › E2E-03 (b24fe50, 3765da0)
- [x] **LAYOUT-06** `P0` `Phase 1` — Configure node and layer spacing — ✅ src/domain/layout/elk.test.ts › node/layer spacing, tests/e2e/editor.spec.ts › E2E-03 (b24fe50, 3765da0)
- [x] **LAYOUT-07** `P0` `Phase 1` — Straight, Bezier, step, and smooth-step edges — ✅ tests/e2e/editor.spec.ts › E2E-03, src/components/diagram/nodes-edges.test.tsx, tests/e2e/visual.spec.ts › VR-06 (3765da0, 02f134d, 05ad960)
- [x] **LAYOUT-08** `P0` `Phase 0–1` — Persist manual overrides in separate `.layout.yaml` files — ✅ tests/e2e/editor.spec.ts › E2E-02/03 save and verify .layout.yaml (3765da0)
  - [x] Phase 0: deterministic `.layout.yaml` read/write round-trip and safe save — src/domain/layout/layout.test.ts, persistence.integration.test.ts (f7d9d3d, 61a78db)
  - [x] Phase 1: editor saves manual overrides
- [x] **LAYOUT-09** `P0` `Phase 1` — Undo/redo layout operations — ✅ tests/e2e/editor.spec.ts › E2E-02 undo/redo, src/editor/history.test.ts (3765da0, 58feec7)
- [x] **LAYOUT-10** `P0` `Phase 1` — Minimap, zoom, pan, and fit-to-view — ✅ tests/e2e/editor.spec.ts › LAYOUT-10 (dbbdea6)
- [x] **LAYOUT-11** `P0` `Phase 0–1` — Preserve compatible positions when models change — ✅ tests/e2e/editor.spec.ts › E2E-04 keeps unsaved edits, src/editor/state.test.ts › rebases (3765da0, 58feec7)
  - [x] Phase 0: reconciliation keeps compatible positions — repository.integration.test.ts (88ddabb)
  - [x] Phase 1: editor behaviour
- [x] **LAYOUT-12** `P0` `Phase 1` — Explicit Re-layout All operation — ✅ tests/e2e/editor.spec.ts › E2E-03 Re-layout all, diagram-editor.test.tsx (3765da0, 02f134d)
- [x] **LAYOUT-13** `P0` `Phase 0–1` — Report orphaned layout references — ✅ tests/e2e/editor.spec.ts › DIAG-10 / LAYOUT-13 orphaned overrides shown in the editor (3765da0)
  - [x] Phase 0: orphan diagnostics (LAYOUT_ORPHAN_*) — src/domain/validate.test.ts (0f11a18)
  - [x] Phase 1: shown in the editor
- [x] **LAYOUT-14** `P1` `Phase 1` — Nested boundaries and grouping — ✅ src/domain/layout/elk.test.ts › LAYOUT-14, tests/e2e/editor.spec.ts › LAYOUT-14, tests/e2e/visual.spec.ts › VR-07; semantics per ADD-006 (Proposed) (b24fe50, 3765da0, 05ad960)
- [x] **LAYOUT-15** `P0` `Phase 1` — Export PNG and SVG diagrams — ✅ tests/e2e/editor.spec.ts › E2E-05, src/components/diagram/export.test.tsx (3765da0, 02f134d)
- [x] **LAYOUT-25** `P1` `Phase 1` — Optional animated edge direction flow; off by default, per-diagram and per-edge, respects reduced motion, static in exports (added by ADD-005) — ✅ src/domain/layout/layout.test.ts › LAYOUT-25, tests/e2e/editor.spec.ts › LAYOUT-25 reduced motion and E2E-05 static export, tests/e2e/performance.spec.ts › BENCH-04 (ada00ff, 3765da0, 2df0b27)

## Layout precedence (§4)

- [x] **PREC-01** `Phase 0` — Precedence applied in order: app defaults → workspace defaults → diagram defaults → generated positions → layout-file overrides — ✅ src/domain/layout/layout.test.ts › configuration precedence (f7d9d3d)
- [x] **PREC-02** `Phase 0` — Scalar styling/spacing: higher-level explicit settings override lower defaults — ✅ src/domain/layout/layout.test.ts › explicit false/zero values still override (f7d9d3d)
- [x] **PREC-03** `Phase 0` — Generated positions apply only to positioning — ✅ src/domain/layout/layout.test.ts › generated apply only to positioning (f7d9d3d)

## Layout reconciliation (§4)

- [x] **LAYOUT-16** `Phase 0` — Manually positioned nodes keep compatible coordinates on normal reloads — ✅ src/domain/layout/layout.test.ts, src/server/workspace/repository.integration.test.ts › retains manual positions (f7d9d3d, 88ddabb)
- [x] **LAYOUT-17** `Phase 0` — New nodes get generated positions without replacing existing manual positions — ✅ src/domain/layout/layout.test.ts › places new nodes (f7d9d3d)
- [x] **LAYOUT-18** `Phase 0` — Removed/renamed instance references with remaining overrides produce diagnostics — ✅ src/domain/validate.test.ts › orphaned overrides, repository.integration.test.ts › LAYOUT-18 (0f11a18, 88ddabb)
- [x] **LAYOUT-19** `Phase 1` — Automatic layout runs only on explicit user action, not every render — ✅ ELK runs only for nodes without saved positions (memoized) or on Re-layout all: src/domain/layout/elk.test.ts › LAYOUT-24, diagram-editor.test.tsx (b24fe50, 02f134d)
- [x] **LAYOUT-20** `Phase 1` — Re-layout All regenerates all positions — ✅ src/editor/state.test.ts › re-layout places every node, tests/e2e/editor.spec.ts › E2E-03 (58feec7, 3765da0)
- [x] **LAYOUT-21** `Phase 1` — Generated positions reproducible for identical input, config, and pinned ELK version — ✅ src/domain/layout/elk.test.ts › reproducible (snapshot), elkjs pinned to 0.12.0 (b24fe50)
- [x] **LAYOUT-22** `Phase 0` — Manual layout changes never modify canonical entity/relationship definitions — ✅ src/server/persistence/persistence.integration.test.ts › never touches canonical or unrelated files (61a78db)
- [x] **LAYOUT-23** `Phase 0` — Saving layout overrides doesn't rewrite unrelated files — ✅ src/server/persistence/persistence.integration.test.ts › refuses files shared with other resources (61a78db)
- [x] **LAYOUT-24** `Phase 1` — Partial regeneration minimizes collisions; unresolved collisions don't silently modify saved positions — ✅ src/domain/layout/elk.test.ts › LAYOUT-24 partial regeneration (b24fe50)
  - [x] Phase 0: interim grid generator avoids manual boxes; unresolved collisions reported, saved positions never moved — src/domain/layout/layout.test.ts (f7d9d3d)
  - [x] Phase 1: ELK partial regeneration
