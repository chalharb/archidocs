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
- [ ] **P0-01** `P0` — Next.js application foundation and testing setup
  - [ ] Next.js + TypeScript (strict) scaffold
  - [ ] ShadCN UI Component Library
  - [ ] Vitest with V8 coverage provider configured
  - [ ] fast-check, React Testing Library, Playwright, axe-core installed and wired
  - [ ] Lint + formatting configured
  - [ ] Server binds to loopback by default (SEC-01)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-02 — Canonical TypeScript domain contracts
- [ ] **P0-02** `P0` — Canonical TypeScript domain contracts
  - [ ] Types for all 9 resource kinds (Workspace, Project, Entity, EntitySet, EntityType, RelationshipSet, RelationshipType, Diagram, DiagramLayout)
  - [ ] Normalized canonical model types (entity, relationship, diagram, view instance)
  - [ ] Diagnostic types (severity, file, path, message, code)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-03 — YAML schemas and normalization
- [ ] **P0-03** `P0` — YAML schemas and normalization
  - [ ] Strict Zod schema per resource kind (SCHEMA-01)
  - [ ] `Entity` and `EntitySet` normalize identically (SCHEMA-02, MODEL-03)
  - [ ] Unsupported `archdocs/v*` versions produce explicit errors (SCHEMA-07)
  - [ ] Unknown fields produce actionable diagnostics (SCHEMA-08)
  - [ ] Normalization independent of file order (SCHEMA-09)
  - [ ] Safe YAML parsing: no custom tags / code execution (SEC-05)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Property-based tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-04 — Workspace discovery and secure file loading
- [ ] **P0-04** `P0` — Workspace discovery and secure file loading
  - [ ] Discover YAML resources under configured workspace roots
  - [ ] Restrict file access to workspace roots (SEC-02)
  - [ ] Reject path traversal (SEC-03)
  - [ ] Reject unsafe symlinks (SEC-04)
  - [ ] File-size and parse-depth limits (SEC-06)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Integration tests (temp dirs) · [ ] Lint/format/types clean · [ ] Coverage met

### P0-05 — Cross-resource validation
- [ ] **P0-05** `P0` — Cross-resource validation
  - [ ] Unique IDs per category across workspace (SCHEMA-03)
  - [ ] EntitySet ID uniqueness (SCHEMA-04)
  - [ ] Acyclic parent hierarchy (SCHEMA-05, MODEL-10)
  - [ ] Relationship endpoint type validation with inheritance (SCHEMA-06)
  - [ ] Missing reference diagnostics (MODEL-07)
  - [ ] Diagram endpoint mismatch diagnostics
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-06 — Architecture graph index
- [ ] **P0-06** `P0` — Architecture graph index
  - [ ] Incoming/outgoing relationship lookups
  - [ ] Parent/child lookups
  - [ ] Entity → diagram reverse references
  - [ ] Deterministic index rebuild
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-07 — Diagram resolution
- [ ] **P0-07** `P0` — Diagram resolution
  - [ ] Resolve diagram definitions into normalized renderable nodes/edges
  - [ ] Rendered nodes keep canonical model references (DIAG-08)
  - [ ] Multiple view instances of one entity (DIAG-09)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-08 — Layout configuration and serialization
- [ ] **P0-08** `P0` — Layout configuration and serialization
  - [ ] Five-level precedence: app → workspace → diagram → generated → layout-file overrides
  - [ ] `.layout.yaml` read/write round-trip
  - [ ] Reconciliation: retain compatible positions, place new nodes, report orphans (LAYOUT-16/17/18)
  - [ ] Layout changes never touch canonical files (LAYOUT-22/23)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-09 — Next.js domain service integration
- [ ] **P0-09** `P0` — Next.js domain service integration
  - [ ] All filesystem access via server-side repository services (SEC-09)
  - [ ] Request-origin protection on state-changing operations (SEC-07)
  - [ ] Route handlers / server actions expose model, diagnostics, layout save
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Integration tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-10 — Example workspaces and regression fixtures
- [ ] **P0-10** `P0` — Example workspaces and regression fixtures
  - [ ] Complete example workspace covering all resource kinds and diagram types
  - [ ] Invalid-input fixtures for each diagnostic class
  - [ ] Benchmark fixtures (100 entities; 100 nodes / 150 edges) (PERF-01)
  - [ ] Acceptance criteria documented
  - [ ] Example workspace passes integration testing

### P0-11 — File watching and safe workspace reload
- [ ] **P0-11** `P0` — File watching and safe workspace reload
  - [ ] Detect external changes (RELI-01)
  - [ ] Validate before updating active model (RELI-02)
  - [ ] Auto-refresh when no local conflicts (RELI-03)
  - [ ] Keep last valid model and flag it stale on failure (RELI-04)
  - [ ] Reload without restart (RELI-14)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Error-path tests · [ ] Integration tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-12 — Persistence conflict detection and failure recovery
- [ ] **P0-12** `P0` — Persistence conflict detection and failure recovery
  - [ ] Revision/hash conflict detection (RELI-06, RELI-07)
  - [ ] Atomic temp-file writes (RELI-08)
  - [ ] Validate before write (RELI-09)
  - [ ] Draft autosave and recovery (RELI-10, RELI-11)
  - [ ] Preserve valid files on write failure (RELI-12)
  - [ ] Acceptance criteria documented
  - [ ] Happy-path tests · [ ] Failure-injection tests · [ ] Integration tests · [ ] Lint/format/types clean · [ ] Coverage met

### P0-13 — Test coverage, performance baselines, and CI enforcement
- [ ] **P0-13** `P0` — Test coverage, performance baselines, and CI enforcement
  - [ ] Coverage thresholds enforced in CI (95% critical / 85% overall / 85% branch)
  - [ ] Benchmark harness and baselines recorded
  - [ ] Reference hardware documented (PERF-05)
  - [ ] All CI gates in checklist 08 running on PRs

---

## Phase 0 Definition of Done (PRD §12)

- [ ] **DOD-01** Both `Entity` and `EntitySet` formats work correctly
- [ ] **DOD-02** All v1 resource schemas validate
- [ ] **DOD-03** Entity and relationship references resolve correctly
- [ ] **DOD-04** Duplicate IDs, invalid hierarchies, and broken relationships produce diagnostics
- [ ] **DOD-05** Diagram definitions resolve to normalized renderable data
- [ ] **DOD-06** Diagram and layout configuration precedence is deterministic
- [ ] **DOD-07** External YAML changes are detected and safely reloaded
- [ ] **DOD-08** Invalid reloads preserve the last valid model
- [ ] **DOD-09** Conflicting writes cannot silently overwrite user changes
- [ ] **DOD-10** Layout files can be written and recovered safely
- [ ] **DOD-11** Filesystem security controls are tested
- [ ] **DOD-12** Core domain coverage meets the established thresholds
- [ ] **DOD-13** CI quality gates pass
- [ ] **DOD-14** A complete example workspace passes integration testing
