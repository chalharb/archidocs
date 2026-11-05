# Diagram Visualization

Source: PRD §2.2. Conventions: [checklists/README.md](README.md).

DIAG-08 and DIAG-09 are resolved in Phase 0 (epic P0-07) and rendered in Phase 1.

- [ ] **DIAG-01** `P0` `Phase 1` — C4 System Context diagrams
- [ ] **DIAG-02** `P0` `Phase 1` — C4 Container diagrams
- [ ] **DIAG-03** `P0` `Phase 1` — C4 Component diagrams
- [ ] **DIAG-04** `P0` `Phase 1` — Network topology diagrams
- [ ] **DIAG-05** `P0` `Phase 1` — Deployment architecture diagrams
- [ ] **DIAG-06** `P1` `Phase 3` — Custom/general-purpose diagrams
- [ ] **DIAG-07** `P1` `Phase 1` — Node inspection and related-diagram navigation
- [ ] **DIAG-08** `P0` `Phase 0–1` — Preserve canonical model references in rendered nodes
  - [x] Phase 0: resolved nodes/edges keep entityId/relationshipId — src/domain/diagram-resolve.test.ts (0f11a18)
  - [ ] Phase 1: rendered nodes keep the references
- [ ] **DIAG-09** `P0` `Phase 0–1` — Support multiple view instances of one canonical entity
  - [x] Phase 0: multiple view instances resolve, edges name instances — src/domain/diagram-resolve.test.ts (0f11a18)
  - [ ] Phase 1: rendering
- [ ] **DIAG-10** `P0` `Phase 1` — Display validation and stale-model diagnostics
  - [x] Phase 0: stale/invalid status and diagnostics in API and status page — src/components/workspace-summary.test.tsx (376c8e5)
  - [ ] Phase 1: diagnostics in the diagram viewer
- [ ] **DIAG-11** `P0` `Phase 1` — Element and relationship styles (shape, colour, line) on types with per-element overrides, resolved through type inheritance (added by ADD-004)

## MVP scope boundary

The MVP doesn't create or delete entities or relationships on the canvas; that's done in YAML.

- [ ] **SCOPE-01** — Canvas exposes no create/delete for entities or relationships (verified by test)
