# Layout Editor and Presentation Persistence

Source: PRD §2.3, §4. Conventions: [checklists/README.md](README.md).

## Interactive layout editor (§2.3)

- [ ] **LAYOUT-01** `P0` `Phase 1` — Drag and reposition existing nodes
- [ ] **LAYOUT-02** `P0` `Phase 1` — Align and distribute selected nodes
- [ ] **LAYOUT-03** `P0` `Phase 1` — Configurable grid snapping
- [ ] **LAYOUT-04** `P0` `Phase 1` — Automatic layout using ELK.js
- [ ] **LAYOUT-05** `P0` `Phase 1` — UP, DOWN, LEFT, RIGHT orientation
- [ ] **LAYOUT-06** `P0` `Phase 1` — Configure node and layer spacing
- [ ] **LAYOUT-07** `P0` `Phase 1` — Straight, Bezier, step, and smooth-step edges
- [ ] **LAYOUT-08** `P0` `Phase 0–1` — Persist manual overrides in separate `.layout.yaml` files
  - [x] Phase 0: deterministic `.layout.yaml` read/write round-trip and safe save — src/domain/layout/layout.test.ts, persistence.integration.test.ts (f7d9d3d, 61a78db)
  - [ ] Phase 1: editor saves manual overrides
- [ ] **LAYOUT-09** `P0` `Phase 1` — Undo/redo layout operations
- [ ] **LAYOUT-10** `P0` `Phase 1` — Minimap, zoom, pan, and fit-to-view
- [ ] **LAYOUT-11** `P0` `Phase 0–1` — Preserve compatible positions when models change
  - [x] Phase 0: reconciliation keeps compatible positions — repository.integration.test.ts (88ddabb)
  - [ ] Phase 1: editor behaviour
- [ ] **LAYOUT-12** `P0` `Phase 1` — Explicit Re-layout All operation
- [ ] **LAYOUT-13** `P0` `Phase 0–1` — Report orphaned layout references
  - [x] Phase 0: orphan diagnostics (LAYOUT_ORPHAN_*) — src/domain/validate.test.ts (0f11a18)
  - [ ] Phase 1: shown in the editor
- [ ] **LAYOUT-14** `P1` `Phase 1` — Nested boundaries and grouping
- [ ] **LAYOUT-15** `P0` `Phase 1` — Export PNG and SVG diagrams
- [ ] **LAYOUT-25** `P1` `Phase 1` — Optional animated edge direction flow; off by default, per-diagram and per-edge, respects reduced motion, static in exports (added by ADD-005)

## Layout precedence (§4)

- [x] **PREC-01** `Phase 0` — Precedence applied in order: app defaults → workspace defaults → diagram defaults → generated positions → layout-file overrides — ✅ src/domain/layout/layout.test.ts › configuration precedence (f7d9d3d)
- [x] **PREC-02** `Phase 0` — Scalar styling/spacing: higher-level explicit settings override lower defaults — ✅ src/domain/layout/layout.test.ts › explicit false/zero values still override (f7d9d3d)
- [x] **PREC-03** `Phase 0` — Generated positions apply only to positioning — ✅ src/domain/layout/layout.test.ts › generated apply only to positioning (f7d9d3d)

## Layout reconciliation (§4)

- [x] **LAYOUT-16** `Phase 0` — Manually positioned nodes keep compatible coordinates on normal reloads — ✅ src/domain/layout/layout.test.ts, src/server/workspace/repository.integration.test.ts › retains manual positions (f7d9d3d, 88ddabb)
- [x] **LAYOUT-17** `Phase 0` — New nodes get generated positions without replacing existing manual positions — ✅ src/domain/layout/layout.test.ts › places new nodes (f7d9d3d)
- [x] **LAYOUT-18** `Phase 0` — Removed/renamed instance references with remaining overrides produce diagnostics — ✅ src/domain/validate.test.ts › orphaned overrides, repository.integration.test.ts › LAYOUT-18 (0f11a18, 88ddabb)
- [ ] **LAYOUT-19** `Phase 1` — Automatic layout runs only on explicit user action, not every render
- [ ] **LAYOUT-20** `Phase 1` — Re-layout All regenerates all positions
- [ ] **LAYOUT-21** `Phase 1` — Generated positions reproducible for identical input, config, and pinned ELK version
- [x] **LAYOUT-22** `Phase 0` — Manual layout changes never modify canonical entity/relationship definitions — ✅ src/server/persistence/persistence.integration.test.ts › never touches canonical or unrelated files (61a78db)
- [x] **LAYOUT-23** `Phase 0` — Saving layout overrides doesn't rewrite unrelated files — ✅ src/server/persistence/persistence.integration.test.ts › refuses files shared with other resources (61a78db)
- [ ] **LAYOUT-24** `Phase 1` — Partial regeneration minimizes collisions; unresolved collisions don't silently modify saved positions
  - [x] Phase 0: interim grid generator avoids manual boxes; unresolved collisions reported, saved positions never moved — src/domain/layout/layout.test.ts (f7d9d3d)
  - [ ] Phase 1: ELK partial regeneration
