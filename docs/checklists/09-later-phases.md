# Later Phases (2–5) and Future Scope

Source: PRD §11, §13. Conventions: [checklists/README.md](README.md). These phases are only outlined in the PRD. Break each into detailed requirements through an addendum before starting it.

## Phase 1 — Diagram Viewer and Layout Editor

Detailed items are in checklists 02, 03, 06 (E2E/VR), and 07.

- [x] **PH1-EXIT** — A user can visually arrange YAML-defined architecture diagrams without modifying the canonical architecture model — ✅ docs/phase-1-acceptance.md

## Phase 2 — Architecture Documentation and ADRs

Detailed items are in checklist [10](10-documentation.md), plus SEC-11..12 (05), TEST-08, E2E-06..08 and VR-10..11 (06), and BENCH-07 (07), per [ADD-009](../addenda/ADD-009-phase-2-documentation-and-adrs.md). Tick each outline item when the items it maps to are done.

- [x] **PH2-01** — Markdown documents (→ DOC-01, DOC-02, DOC-06) — ✅ checklist 10
- [x] **PH2-02** — Structured ADRs (→ ADR-01, ADR-02) — ✅ checklist 10
- [x] **PH2-03** — Entity traceability (→ DOC-03, DOC-04) — ✅ checklist 10
- [x] **PH2-04** — ADR supersession (→ ADR-03, ADR-05) — ✅ checklist 10
- [x] **PH2-05** — Reverse references (→ DOC-05) — ✅ checklist 10
- [x] **PH2-06** — Documentation navigation (→ DOC-06, ADR-04) — ✅ checklist 10
- [ ] **PH2-EXIT** — A user can write architecture documentation and decisions in Markdown that link to the YAML model, and navigate between documents, decisions, entities and diagrams in both directions, without the app modifying any canonical file (added by ADD-009)

## Phase 3 — Advanced Diagrams and Flows

- [ ] **PH3-01** — Custom diagrams (see DIAG-06)
- [ ] **PH3-02** — Structured flow models
- [ ] **PH3-03** — Flowcharts
- [ ] **PH3-04** — Sequence diagrams
- [ ] **PH3-05** — Advanced grouping

## Phase 4 — Versioning and GitHub

- [ ] **PH4-01** — Revision comparisons
- [ ] **PH4-02** — Semantic diffs
- [ ] **PH4-03** — Recovery
- [ ] **PH4-04** — Git branches and commits
- [ ] **PH4-05** — PR integration
- [ ] **PH4-06** — Validation workflows
- [ ] **RELI-15** `P1` `Phase 4` — Distinguish Git-committed revisions from saved but uncommitted file revisions (added by ADD-002)

## Phase 5 — Team Collaboration

- [ ] **PH5-01** — Authentication
- [ ] **PH5-02** — RBAC
- [ ] **PH5-03** — Workspace permissions
- [ ] **PH5-04** — Team sharing
- [ ] **PH5-05** — Multi-tenant capabilities

## Out of MVP scope (§13)

Reference list, not tracked. Moving any of these into scope requires an addendum.

- Creating and deleting architecture entities visually
- Visual relationship creation
- Real-time collaboration
- Authentication and RBAC
- Hosted multi-tenant deployments
- Advanced Git merge management
- External diagram imports
- Automatic cloud infrastructure discovery
- Additional source control providers
- Fully configurable diagram rendering engines
