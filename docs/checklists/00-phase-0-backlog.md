# Phase 0 — Reliable YAML Model Foundation

Source: PRD §9, §11, §12. Conventions: [checklists/README.md](README.md).

**Exit criterion:** A YAML workspace can be loaded, validated, changed externally, indexed, and safely persisted with deterministic behavior and automated test coverage.

## Per-epic requirements (PRD §9)

Each epic below is done only when all of these hold. They're repeated under each epic so they can be ticked per epic.

- Automated happy-path tests
- Automated invalid-input and error-path tests
- Integration tests where filesystem or service boundaries are involved
- Documented acceptance criteria
- No unhandled TypeScript errors
- Passing lint and formatting checks
- Passing relevant coverage thresholds

---

## Epics

### P0-01 — Next.js application foundation and testing setup
- [x] **P0-01** `P0` — Next.js application foundation and testing setup — ✅ docs/phase-0-acceptance.md; 57e6a56, 5fa9462, 0a913ee
  - [x] Next.js + TypeScript (strict) scaffold
  - [x] ShadCN UI Component Library
  - [x] Vitest with V8 coverage provider configured
  - [x] fast-check, React Testing Library, Playwright, axe-core installed and wired
  - [x] Lint + formatting configured
  - [x] Server binds to loopback by default (SEC-01)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Lint/format/types clean · [x] Coverage met

### P0-02 — Canonical TypeScript domain contracts
- [x] **P0-02** `P0` — Canonical TypeScript domain contracts — ✅ docs/phase-0-acceptance.md; ab89aac
  - [x] Types for all 9 resource kinds (Workspace, Project, Entity, EntitySet, EntityType, RelationshipSet, RelationshipType, Diagram, DiagramLayout)
  - [x] Normalized canonical model types (entity, relationship, diagram, view instance)
  - [x] Diagnostic types (severity, file, path, message, code)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Lint/format/types clean · [x] Coverage met

### P0-03 — YAML schemas and normalization
- [x] **P0-03** `P0` — YAML schemas and normalization — ✅ docs/phase-0-acceptance.md; ab89aac, 71ac6c9
  - [x] Strict Zod schema per resource kind (SCHEMA-01)
  - [x] `Entity` and `EntitySet` normalize identically (SCHEMA-02, MODEL-03)
  - [x] Unsupported `archdocs/v*` versions produce explicit errors (SCHEMA-07)
  - [x] Unknown fields produce actionable diagnostics (SCHEMA-08)
  - [x] Normalization independent of file order (SCHEMA-09)
  - [x] Safe YAML parsing: no custom tags / code execution (SEC-05)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Property-based tests · [x] Lint/format/types clean · [x] Coverage met

### P0-04 — Workspace discovery and secure file loading
- [x] **P0-04** `P0` — Workspace discovery and secure file loading — ✅ docs/phase-0-acceptance.md; 0b9418e
  - [x] Discover YAML resources under configured workspace roots
  - [x] Restrict file access to workspace roots (SEC-02)
  - [x] Reject path traversal (SEC-03)
  - [x] Reject unsafe symlinks (SEC-04)
  - [x] File-size and parse-depth limits (SEC-06)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Integration tests (temp dirs) · [x] Lint/format/types clean · [x] Coverage met

### P0-05 — Cross-resource validation
- [x] **P0-05** `P0` — Cross-resource validation — ✅ docs/phase-0-acceptance.md; 0f11a18
  - [x] Unique IDs per category across workspace (SCHEMA-03)
  - [x] EntitySet ID uniqueness (SCHEMA-04)
  - [x] Acyclic parent hierarchy (SCHEMA-05, MODEL-10)
  - [x] Relationship endpoint type validation with inheritance (SCHEMA-06)
  - [x] Missing reference diagnostics (MODEL-07)
  - [x] Diagram endpoint mismatch diagnostics
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Lint/format/types clean · [x] Coverage met

### P0-06 — Architecture graph index
- [x] **P0-06** `P0` — Architecture graph index — ✅ docs/phase-0-acceptance.md; 51d2f16
  - [x] Incoming/outgoing relationship lookups
  - [x] Parent/child lookups
  - [x] Entity → diagram reverse references
  - [x] Deterministic index rebuild
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Lint/format/types clean · [x] Coverage met

### P0-07 — Diagram resolution
- [x] **P0-07** `P0` — Diagram resolution — ✅ docs/phase-0-acceptance.md; 0f11a18
  - [x] Resolve diagram definitions into normalized renderable nodes/edges
  - [x] Rendered nodes keep canonical model references (DIAG-08)
  - [x] Multiple view instances of one entity (DIAG-09)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Lint/format/types clean · [x] Coverage met

### P0-08 — Layout configuration and serialization
- [x] **P0-08** `P0` — Layout configuration and serialization — ✅ docs/phase-0-acceptance.md; f7d9d3d, 61a78db
  - [x] Five-level precedence: app → workspace → diagram → generated → layout-file overrides
  - [x] `.layout.yaml` read/write round-trip
  - [x] Reconciliation: retain compatible positions, place new nodes, report orphans (LAYOUT-16/17/18)
  - [x] Layout changes never touch canonical files (LAYOUT-22/23)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Lint/format/types clean · [x] Coverage met

### P0-09 — Next.js domain service integration
- [x] **P0-09** `P0` — Next.js domain service integration — ✅ docs/phase-0-acceptance.md; 58c2506, 376c8e5
  - [x] All filesystem access via server-side repository services (SEC-09)
  - [x] Request-origin protection on state-changing operations (SEC-07)
  - [x] Route handlers / server actions expose model, diagnostics, layout save
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Integration tests · [x] Lint/format/types clean · [x] Coverage met

### P0-10 — Example workspaces and regression fixtures
- [x] **P0-10** `P0` — Example workspaces and regression fixtures — ✅ docs/phase-0-acceptance.md; 6ba9f61, cdb3aa7, 88dcfeb
  - [x] Complete example workspace covering all resource kinds and diagram types
  - [x] Invalid-input fixtures for each diagnostic class
  - [x] Benchmark fixtures (100 entities; 100 nodes / 150 edges) (PERF-01)
  - [x] Acceptance criteria documented
  - [x] Example workspace passes integration testing

### P0-11 — File watching and safe workspace reload
- [x] **P0-11** `P0` — File watching and safe workspace reload — ✅ docs/phase-0-acceptance.md; 88ddabb, 7b2ae36
  - [x] Detect external changes (RELI-01)
  - [x] Validate before updating active model (RELI-02)
  - [x] Auto-refresh when no local conflicts (RELI-03)
  - [x] Keep last valid model and flag it stale on failure (RELI-04)
  - [x] Reload without restart (RELI-14)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Error-path tests · [x] Integration tests · [x] Lint/format/types clean · [x] Coverage met

### P0-12 — Persistence conflict detection and failure recovery
- [x] **P0-12** `P0` — Persistence conflict detection and failure recovery — ✅ docs/phase-0-acceptance.md; 0b9418e, 61a78db, 88ddabb
  - [x] Revision/hash conflict detection (RELI-06, RELI-07)
  - [x] Atomic temp-file writes (RELI-08)
  - [x] Validate before write (RELI-09)
  - [x] Draft autosave and recovery (RELI-10, RELI-11)
  - [x] Preserve valid files on write failure (RELI-12)
  - [x] Acceptance criteria documented
  - [x] Happy-path tests · [x] Failure-injection tests · [x] Integration tests · [x] Lint/format/types clean · [x] Coverage met

### P0-13 — Test coverage, performance baselines, and CI enforcement
- [x] **P0-13** `P0` — Test coverage, performance baselines, and CI enforcement; running gates on pull requests deferred (amended by ADD-003) — ✅ `pnpm check` + `pnpm test:e2e`, .github/workflows/ci.yml (c72d633, 88dcfeb)
  - [x] Coverage thresholds enforced (95% critical / 85% overall / 85% branch) — `pnpm test:coverage` fails below threshold; runs in the CI `test` job (c72d633)
  - [x] Benchmark harness and baselines recorded — tests/bench, docs/performance.md (88dcfeb)
  - [x] Reference hardware documented (PERF-05) — docs/performance.md (88dcfeb)
  - [ ] ~~All CI gates in checklist 08 running on PRs~~ (deferred by ADD-003 until a GitHub remote exists)

---

## Phase 0 Definition of Done (PRD §12)

- [x] **DOD-01** Both `Entity` and `EntitySet` formats work correctly — ✅ src/domain/normalize.test.ts; sample workspace uses both formats
- [x] **DOD-02** All v1 resource schemas validate — ✅ src/domain/schema/resource-schemas.test.ts
- [x] **DOD-03** Entity and relationship references resolve correctly — ✅ src/domain/validate.test.ts, src/domain/graph-index.test.ts
- [x] **DOD-04** Duplicate IDs, invalid hierarchies, and broken relationships produce diagnostics — ✅ tests/integration/invalid-fixtures.test.ts
- [x] **DOD-05** Diagram definitions resolve to normalized renderable data — ✅ src/domain/diagram-resolve.test.ts
- [x] **DOD-06** Diagram and layout configuration precedence is deterministic — ✅ src/domain/layout/layout.test.ts › precedence (property-based)
- [x] **DOD-07** External YAML changes are detected and safely reloaded — ✅ src/server/workspace/repository.integration.test.ts › file watching
- [x] **DOD-08** Invalid reloads preserve the last valid model — ✅ src/server/workspace/snapshot.test.ts, repository.integration.test.ts
- [x] **DOD-09** Conflicting writes cannot silently overwrite user changes — ✅ src/server/persistence/persistence.integration.test.ts › RELI-07
- [x] **DOD-10** Layout files can be written and recovered safely — ✅ persistence.integration.test.ts, repository.integration.test.ts › drafts
- [x] **DOD-11** Filesystem security controls are tested — ✅ src/server/fs/fs.integration.test.ts, src/server/http/request-guard.test.ts
- [x] **DOD-12** Core domain coverage meets the established thresholds — ✅ coverage: domain branches 95.36%, overall branches 95.2%
- [x] **DOD-13** CI quality gates pass locally; passing on GitHub deferred (amended by ADD-003) — ✅ `pnpm check` (406 tests, coverage thresholds, build) and `pnpm test:e2e` (5 tests) pass on 7daf8fe
- [x] **DOD-14** A complete example workspace passes integration testing — ✅ repository.integration.test.ts › loading the example workspace
