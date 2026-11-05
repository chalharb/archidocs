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
- [ ] **LAYOUT-09** `P0` `Phase 1` — Undo/redo layout operations
- [ ] **LAYOUT-10** `P0` `Phase 1` — Minimap, zoom, pan, and fit-to-view
- [ ] **LAYOUT-11** `P0` `Phase 0–1` — Preserve compatible positions when models change
- [ ] **LAYOUT-12** `P0` `Phase 1` — Explicit Re-layout All operation
- [ ] **LAYOUT-13** `P0` `Phase 0–1` — Report orphaned layout references
- [ ] **LAYOUT-14** `P1` `Phase 1` — Nested boundaries and grouping
- [ ] **LAYOUT-15** `P0` `Phase 1` — Export PNG and SVG diagrams

## Layout precedence (§4)

- [ ] **PREC-01** `Phase 0` — Precedence applied in order: app defaults → workspace defaults → diagram defaults → generated positions → layout-file overrides
- [ ] **PREC-02** `Phase 0` — Scalar styling/spacing: higher-level explicit settings override lower defaults
- [ ] **PREC-03** `Phase 0` — Generated positions apply only to positioning

## Layout reconciliation (§4)

- [ ] **LAYOUT-16** `Phase 0` — Manually positioned nodes keep compatible coordinates on normal reloads
- [ ] **LAYOUT-17** `Phase 0` — New nodes get generated positions without replacing existing manual positions
- [ ] **LAYOUT-18** `Phase 0` — Removed/renamed instance references with remaining overrides produce diagnostics
- [ ] **LAYOUT-19** `Phase 1` — Automatic layout runs only on explicit user action, not every render
- [ ] **LAYOUT-20** `Phase 1` — Re-layout All regenerates all positions
- [ ] **LAYOUT-21** `Phase 1` — Generated positions reproducible for identical input, config, and pinned ELK version
- [ ] **LAYOUT-22** `Phase 0` — Manual layout changes never modify canonical entity/relationship definitions
- [ ] **LAYOUT-23** `Phase 0` — Saving layout overrides doesn't rewrite unrelated files
- [ ] **LAYOUT-24** `Phase 1` — Partial regeneration minimizes collisions; unresolved collisions don't silently modify saved positions
