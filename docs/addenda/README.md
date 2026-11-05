# PRD Addenda

Changes, pivots, and clarifications to the [baseline PRD v1.6](../Archidocs-prd.md). The workflow is described in [docs/README.md §3](../README.md#3-changing-requirements-addenda).

**Effective requirements = baseline PRD + all `Accepted` addenda below, applied in number order.**

## Index

| ID | Title | Status | Date | Affected IDs |
|---|---|---|---|---|
| [ADD-001](ADD-001-archdocs-v1-schema.md) | Field-level definition of the `archdocs/v1` schema | Accepted | 2026-11-05 | MODEL-01..10, SCHEMA-01..09, LAYOUT-08, LAYOUT-18, LAYOUT-23, SEC-06, SEC-08 |
| [ADD-002](ADD-002-defer-git-revision-state.md) | Defer Git-committed revision state (RELI-10) to Phase 4 | Accepted | 2026-11-05 | RELI-10, RELI-15 (new) |
| [ADD-003](ADD-003-defer-github-ci.md) | Defer GitHub-hosted CI until the repository is pushed to GitHub | Accepted | 2026-11-05 | CI-01..08, CI-REQ, P0-13, DOD-13 |

## Allocated requirement IDs

New IDs introduced by addenda are recorded here so nobody allocates the same ID twice. The baseline already uses these ranges:

| Family | Baseline range | Next free |
|---|---|---|
| MODEL | 01–10 | MODEL-11 |
| SCHEMA | 01–10 | SCHEMA-11 |
| DIAG | 01–10 | DIAG-11 |
| LAYOUT | 01–24 | LAYOUT-25 |
| RELI | 01–14; RELI-15 (ADD-002) | RELI-16 |
| SEC | 01–10 | SEC-11 |
| TEST | 01–07 | TEST-08 |
| PERF | 01–05 | PERF-06 |
| CI | 01–08 (assigned in checklist 08) | CI-09 |
| P0 | 01–13 | P0-14 |
