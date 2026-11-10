# PRD Addenda

Changes, pivots, and clarifications to the [baseline PRD v1.7](../Archidocs-prd.md). The workflow is described in [docs/README.md §3](../README.md#3-changing-requirements-addenda).

**Effective requirements = baseline PRD v1.7 + all `Accepted` addenda below, applied in number order.** ADD-001 to ADD-008 are already part of v1.7.

## Index

| ID | Title | Status | Date | Affected IDs |
|---|---|---|---|---|
| [ADD-001](ADD-001-archdocs-v1-schema.md) | Field-level definition of the `archdocs/v1` schema | Consolidated into v1.7 | 2026-11-05 | MODEL-01..10, SCHEMA-01..09, LAYOUT-08, LAYOUT-18, LAYOUT-23, SEC-06, SEC-08 |
| [ADD-002](ADD-002-defer-git-revision-state.md) | Defer Git-committed revision state (RELI-10) to Phase 4 | Consolidated into v1.7 | 2026-11-05 | RELI-10, RELI-15 (new) |
| [ADD-003](ADD-003-defer-github-ci.md) | Defer GitHub-hosted CI until the repository is pushed to GitHub | Consolidated into v1.7 | 2026-11-05 | CI-01..08, CI-REQ, P0-13, DOD-13 |
| [ADD-004](ADD-004-element-and-relationship-styles.md) | Element and relationship styles (shapes, colours, line styles) | Consolidated into v1.7 | 2026-11-05 | DIAG-11 (new), DIAG-01..05, LAYOUT-22, VR-01..09 |
| [ADD-005](ADD-005-animated-edge-flow.md) | Optional animated edge direction flow | Consolidated into v1.7 | 2026-11-05 | LAYOUT-25 (new), LAYOUT-15, PREC-01/02, BENCH-04, VR-01..09 |
| [ADD-006](ADD-006-nested-boundary-semantics.md) | Nested boundary membership and layout coordinates | Consolidated into v1.7 | 2026-11-05 | LAYOUT-14, LAYOUT-08, LAYOUT-24 |
| [ADD-007](ADD-007-separate-view-and-edit-routes.md) | Separate routes for viewing and editing diagrams | Consolidated into v1.7 | 2026-11-05 | DIAG-12 (new), DIAG-07, DIAG-10, LAYOUT-01..15, LAYOUT-25, SCOPE-01, E2E-01..05, VR-01..09 |
| [ADD-008](ADD-008-optional-minimap.md) | Optional minimap | Consolidated into v1.7 | 2026-11-05 | LAYOUT-26 (new), LAYOUT-10, PREC-01/02 |
| [ADD-009](ADD-009-phase-2-documentation-and-adrs.md) | Phase 2 requirements: architecture documentation and ADRs | Accepted | 2026-11-05 | DOC-01..09, ADR-01..05, SEC-11..12, TEST-08, E2E-06..08, VR-10..11, BENCH-07, PH2-EXIT (all new); PH2-01..06, RELI-01..05, MODEL-07, DIAG-07 |
| [ADD-010](ADD-010-hosted-read-only-mode.md) | Hosted read-only mode (Vercel) | Accepted | 2026-11-05 | SEC-13 (new), SEC-01, SEC-10, RELI-01, LAYOUT-08, DIAG-12, RELI-11 |
| [ADD-011](ADD-011-phase-3-advanced-diagrams-and-flows.md) | Phase 3 requirements: advanced diagrams and flows | Accepted | 2026-11-06 | MODEL-11..12, DIAG-13..15, LAYOUT-27, TEST-09, E2E-09..11, VR-12..14, BENCH-08, PH3-EXIT (all new); DIAG-06, PH3-01..05, SCOPE-01, DIAG-07, DIAG-11, LAYOUT-08, LAYOUT-14, LAYOUT-15 |
| [ADD-013](ADD-013-phase-5-team-collaboration.md) | Phase 5 requirements: team collaboration | Proposed | 2026-11-10 | TEAM-01..10, SEC-15..16, TEST-11, E2E-15..17, VR-17..18, BENCH-10, PH5-EXIT (all new); PH5-01..05, SEC-01, SEC-07..10, SEC-13, RELI-11, GIT-08 |

## Allocated requirement IDs

New IDs introduced by addenda are recorded here so nobody allocates the same ID twice. The baseline already uses these ranges:

| Family | Baseline range | Next free |
|---|---|---|
| MODEL | 01–10; MODEL-11..12 (ADD-011, Proposed) | MODEL-13 |
| SCHEMA | 01–10 | SCHEMA-11 |
| DIAG | 01–10; DIAG-11 (ADD-004); DIAG-12 (ADD-007); DIAG-13..15 (ADD-011, Proposed) | DIAG-16 |
| LAYOUT | 01–24; LAYOUT-25 (ADD-005); LAYOUT-26 (ADD-008); LAYOUT-27 (ADD-011, Proposed) | LAYOUT-28 |
| RELI | 01–14; RELI-15 (ADD-002) | RELI-16 |
| SEC | 01–10; SEC-11..12 (ADD-009); SEC-13 (ADD-010); SEC-14 (ADD-012, Proposed in #30); SEC-15..16 (ADD-013, Proposed) | SEC-17 |
| TEST | 01–07; TEST-08 (ADD-009); TEST-09 (ADD-011, Proposed); TEST-10 (ADD-012, Proposed in #30); TEST-11 (ADD-013, Proposed) | TEST-12 |
| PERF | 01–05 | PERF-06 |
| CI | 01–08 (assigned in checklist 08) | CI-09 |
| P0 | 01–13 | P0-14 |
| DOC | DOC-01..09 (ADD-009) | DOC-10 |
| ADR | ADR-01..05 (ADD-009) | ADR-06 |
| E2E | 01–05 (checklist 06); E2E-06..08 (ADD-009); E2E-09..11 (ADD-011, Proposed); E2E-12..14 (ADD-012, Proposed in #30); E2E-15..17 (ADD-013, Proposed) | E2E-18 |
| VR | 01–09 (checklist 06); VR-10..11 (ADD-009); VR-12..14 (ADD-011, Proposed); VR-15..16 (ADD-012, Proposed in #30); VR-17..18 (ADD-013, Proposed) | VR-19 |
| BENCH | 01–06 (checklist 07); BENCH-07 (ADD-009); BENCH-08 (ADD-011, Proposed); BENCH-09 (ADD-012, Proposed in #30); BENCH-10 (ADD-013, Proposed) | BENCH-11 |
| PH2 | 01–06 (checklist 09); PH2-EXIT (ADD-009) | PH2-07 |
| PH3 | 01–05 (checklist 09); PH3-EXIT (ADD-011, Proposed) | PH3-06 |
| PH5 | 01–05 (checklist 09); PH5-EXIT (ADD-013, Proposed) | PH5-06 |
| TEAM | TEAM-01..10 (ADD-013, Proposed) | TEAM-11 |
