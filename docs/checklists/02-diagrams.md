# Diagram Visualization

Source: PRD §2.2. Conventions: [checklists/README.md](README.md).

DIAG-08 and DIAG-09 are resolved in Phase 0 (epic P0-07) and rendered in Phase 1.

- [x] **DIAG-01** `P0` `Phase 1` — C4 System Context diagrams — ✅ tests/e2e/visual.spec.ts › VR-01 (05ad960)
- [x] **DIAG-02** `P0` `Phase 1` — C4 Container diagrams — ✅ tests/e2e/editor.spec.ts › E2E-01, tests/e2e/visual.spec.ts › VR-02 (3765da0, 05ad960)
- [x] **DIAG-03** `P0` `Phase 1` — C4 Component diagrams — ✅ tests/e2e/visual.spec.ts › VR-03 (05ad960)
- [x] **DIAG-04** `P0` `Phase 1` — Network topology diagrams — ✅ tests/e2e/editor.spec.ts › LAYOUT-14, tests/e2e/visual.spec.ts › VR-04 (3765da0, 05ad960)
- [x] **DIAG-05** `P0` `Phase 1` — Deployment architecture diagrams — ✅ tests/e2e/editor.spec.ts › DIAG-09, tests/e2e/visual.spec.ts › VR-05 (3765da0, 05ad960)
- [ ] **DIAG-06** `P1` `Phase 3` — Custom/general-purpose diagrams
- [x] **DIAG-07** `P1` `Phase 1` — Node inspection and related-diagram navigation — ✅ tests/e2e/editor.spec.ts › DIAG-07, src/components/diagram/inspector.test.tsx (3765da0, 02f134d)
- [x] **DIAG-08** `P0` `Phase 0–1` — Preserve canonical model references in rendered nodes — ✅ tests/e2e/editor.spec.ts › E2E-01 (data-entity-id), src/editor/flow.test.ts (3765da0, 44da8f4)
  - [x] Phase 0: resolved nodes/edges keep entityId/relationshipId — src/domain/diagram-resolve.test.ts (0f11a18)
  - [x] Phase 1: rendered nodes keep the references — data-entity-id on every node
- [x] **DIAG-09** `P0` `Phase 0–1` — Support multiple view instances of one canonical entity — ✅ tests/e2e/editor.spec.ts › DIAG-09, src/domain/styles.test.ts › same style per view instance (3765da0, ada00ff)
  - [x] Phase 0: multiple view instances resolve, edges name instances — src/domain/diagram-resolve.test.ts (0f11a18)
  - [x] Phase 1: rendering
- [x] **DIAG-10** `P0` `Phase 1` — Display validation and stale-model diagnostics — ✅ tests/e2e/editor.spec.ts › DIAG-10 / LAYOUT-13, E2E-04 stale model; src/components/diagram/diagram-editor.test.tsx (3765da0, 02f134d)
  - [x] Phase 0: stale/invalid status and diagnostics in API and status page — src/components/workspace-summary.test.tsx (376c8e5)
  - [x] Phase 1: diagnostics in the diagram viewer
- [x] **DIAG-11** `P0` `Phase 1` — Element and relationship styles (shape, colour, line) on types with per-element overrides, resolved through type inheritance (added by ADD-004) — ✅ src/domain/styles.test.ts, tests/e2e/editor.spec.ts › E2E-01 shapes, tests/e2e/visual.spec.ts › VR-06 (ada00ff, 3765da0, 05ad960)

## MVP scope boundary

The MVP doesn't create or delete entities or relationships on the canvas; that's done in YAML.

- [x] **SCOPE-01** — Canvas exposes no create/delete for entities or relationships (verified by test) — ✅ tests/e2e/editor.spec.ts › SCOPE-01 (3765da0)
