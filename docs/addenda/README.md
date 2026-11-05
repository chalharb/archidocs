# PRD Addenda

Changes, pivots, and clarifications to the [baseline PRD v1.6](../Archidocs-prd.md). The workflow is described in [docs/README.md §3](../README.md#3-changing-requirements-addenda).

**Effective requirements = baseline PRD + all `Accepted` addenda below, applied in number order.**

## Index

| ID | Title | Status | Date | Affected IDs |
|---|---|---|---|---|
| [ADD-001](ADD-001-archdocs-v1-schema.md) | Field-level definition of the `archdocs/v1` schema | Accepted | 2026-11-05 | MODEL-01..10, SCHEMA-01..09, LAYOUT-08, LAYOUT-18, LAYOUT-23, SEC-06, SEC-08 |
| [ADD-002](ADD-002-defer-git-revision-state.md) | Defer Git-committed revision state (RELI-10) to Phase 4 | Accepted | 2026-11-05 | RELI-10, RELI-15 (new) |
| [ADD-003](ADD-003-defer-github-ci.md) | Defer GitHub-hosted CI until the repository is pushed to GitHub | Accepted | 2026-11-05 | CI-01..08, CI-REQ, P0-13, DOD-13 |
| [ADD-004](ADD-004-element-and-relationship-styles.md) | Element and relationship styles (shapes, colours, line styles) | Accepted | 2026-11-05 | DIAG-11 (new), DIAG-01..05, LAYOUT-22, VR-01..09 |
| [ADD-005](ADD-005-animated-edge-flow.md) | Optional animated edge direction flow | Accepted | 2026-11-05 | LAYOUT-25 (new), LAYOUT-15, PREC-01/02, BENCH-04, VR-01..09 |
| [ADD-006](ADD-006-nested-boundary-semantics.md) | Nested boundary membership and layout coordinates | Accepted | 2026-11-05 | LAYOUT-14, LAYOUT-08, LAYOUT-24 |
| [ADD-007](ADD-007-separate-view-and-edit-routes.md) | Separate routes for viewing and editing diagrams | Accepted | 2026-11-05 | DIAG-12 (new), DIAG-07, DIAG-10, LAYOUT-01..15, LAYOUT-25, SCOPE-01, E2E-01..05, VR-01..09 |

## Allocated requirement IDs

New IDs introduced by addenda are recorded here so nobody allocates the same ID twice. The baseline already uses these ranges:

| Family | Baseline range | Next free |
|---|---|---|
| MODEL | 01–10 | MODEL-11 |
| SCHEMA | 01–10 | SCHEMA-11 |
| DIAG | 01–10; DIAG-11 (ADD-004); DIAG-12 (ADD-007) | DIAG-13 |
| LAYOUT | 01–24; LAYOUT-25 (ADD-005) | LAYOUT-26 |
| RELI | 01–14; RELI-15 (ADD-002) | RELI-16 |
| SEC | 01–10 | SEC-11 |
| TEST | 01–07 | TEST-08 |
| PERF | 01–05 | PERF-06 |
| CI | 01–08 (assigned in checklist 08) | CI-09 |
| P0 | 01–13 | P0-14 |
