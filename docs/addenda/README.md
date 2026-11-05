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
| [ADD-009](ADD-009-phase-2-documentation-and-adrs.md) | Phase 2 requirements: architecture documentation and ADRs | Proposed | 2026-11-05 | DOC-01..09, ADR-01..05, SEC-11..12, TEST-08, E2E-06..08, VR-10..11, BENCH-07, PH2-EXIT (all new); PH2-01..06, RELI-01..05, MODEL-07, DIAG-07 |

## Allocated requirement IDs

New IDs introduced by addenda are recorded here so nobody allocates the same ID twice. The baseline already uses these ranges:

| Family | Baseline range | Next free |
|---|---|---|
| MODEL | 01–10 | MODEL-11 |
| SCHEMA | 01–10 | SCHEMA-11 |
| DIAG | 01–10; DIAG-11 (ADD-004); DIAG-12 (ADD-007) | DIAG-13 |
| LAYOUT | 01–24; LAYOUT-25 (ADD-005); LAYOUT-26 (ADD-008) | LAYOUT-27 |
| RELI | 01–14; RELI-15 (ADD-002) | RELI-16 |
| SEC | 01–10 | SEC-11 |
| TEST | 01–07 | TEST-08 |
| PERF | 01–05 | PERF-06 |
| CI | 01–08 (assigned in checklist 08) | CI-09 |
| P0 | 01–13 | P0-14 |
