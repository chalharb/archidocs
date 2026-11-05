# Architecture Docs — Product Requirements Document

**Version:** 1.6  
**Status:** Approved requirements baseline  
**Technology:** Next.js, TypeScript, React Flow, ELK.js  
**Deployment:** Local-first, single tenant  
**Source of truth:** YAML files  
**Authentication:** Not required for MVP

> **This baseline is frozen.** Changes are recorded as addenda in [`addenda/`](addenda/README.md). Effective requirements = this document + all accepted addenda. Progress is tracked in [`checklists/`](checklists/README.md). See [`README.md`](README.md) for the workflow.

---

## 1. Product Overview

Architecture Docs is a local-first software architecture documentation application for defining, exploring, and maintaining architecture models.

The application supports C4 diagrams, network topology, deployment architecture, custom diagrams, architecture decisions, and technical documentation.

Architecture entities and relationships are defined in YAML. React Flow provides interactive visualization and layout controls without changing canonical architecture definitions.

### Core principles

1. YAML files are the canonical architecture model.
2. Architecture data and visual presentation are stored separately.
3. Multiple diagrams can reference the same canonical entities.
4. Diagram layouts support automatic arrangement and manual overrides.
5. Architecture data must be portable, versionable, and Git-friendly.
6. External YAML editing is a first-class workflow.
7. Invalid data must never silently overwrite valid data.
8. Automated tests are required for core functionality.
9. The local application must enforce filesystem security boundaries.
10. Future capabilities must not require replacing the canonical data model.

---

## 2. MVP Functional Requirements

### 2.1 Architecture Repository

| ID | Requirement | Priority |
|---|---|---|
| MODEL-01 | Support individual `Entity` YAML resources | P0 |
| MODEL-02 | Support grouped `EntitySet` YAML resources | P0 |
| MODEL-03 | Normalize both entity formats into one canonical model | P0 |
| MODEL-04 | Support typed, directional relationships | P0 |
| MODEL-05 | Support standard and custom entity metadata | P0 |
| MODEL-06 | Support configurable entity and relationship type definitions | P0 |
| MODEL-07 | Validate schemas and references | P0 |
| MODEL-08 | Maintain stable canonical identifiers | P0 |
| MODEL-09 | Support reusable entities across diagrams | P0 |
| MODEL-10 | Detect invalid hierarchies and duplicate identifiers | P0 |

### 2.2 Diagram Visualization

| ID | Requirement | Priority |
|---|---|---|
| DIAG-01 | C4 System Context diagrams | P0 |
| DIAG-02 | C4 Container diagrams | P0 |
| DIAG-03 | C4 Component diagrams | P0 |
| DIAG-04 | Network topology diagrams | P0 |
| DIAG-05 | Deployment architecture diagrams | P0 |
| DIAG-06 | Custom/general-purpose diagrams | P1 |
| DIAG-07 | Node inspection and related-diagram navigation | P1 |
| DIAG-08 | Preserve canonical model references in rendered nodes | P0 |
| DIAG-09 | Support multiple view instances of one canonical entity | P0 |
| DIAG-10 | Display validation and stale-model diagnostics | P0 |

### 2.3 Interactive Layout Editor

| ID | Requirement | Priority |
|---|---|---|
| LAYOUT-01 | Drag and reposition existing nodes | P0 |
| LAYOUT-02 | Align and distribute selected nodes | P0 |
| LAYOUT-03 | Configurable grid snapping | P0 |
| LAYOUT-04 | Automatic layout using ELK.js | P0 |
| LAYOUT-05 | Support UP, DOWN, LEFT, RIGHT orientation | P0 |
| LAYOUT-06 | Configure node and layer spacing | P0 |
| LAYOUT-07 | Straight, Bezier, step, and smooth-step edges | P0 |
| LAYOUT-08 | Persist manual overrides in separate `.layout.yaml` files | P0 |
| LAYOUT-09 | Undo/redo layout operations | P0 |
| LAYOUT-10 | Minimap, zoom, pan, and fit-to-view | P0 |
| LAYOUT-11 | Preserve compatible positions when models change | P0 |
| LAYOUT-12 | Explicit Re-layout All operation | P0 |
| LAYOUT-13 | Report orphaned layout references | P0 |
| LAYOUT-14 | Support nested boundaries and grouping | P1 |
| LAYOUT-15 | Export PNG and SVG diagrams | P0 |

The MVP does not support creating or deleting architecture entities or relationships through the canvas. Those operations are performed through YAML.

---

## 3. YAML Specification Requirements

### Resource structure

The `archdocs/v1` schema supports:

- Workspace
- Project
- Entity
- EntitySet
- EntityType
- RelationshipSet
- RelationshipType
- Diagram
- DiagramLayout

### Schema consistency requirements

**SCHEMA-01:** Each resource kind must have a strict validation schema.

**SCHEMA-02:** Individual and grouped entities must normalize to identical internal representations.

**SCHEMA-03:** Canonical entity, relationship, and diagram IDs must be unique within the workspace across their respective resource categories.

**SCHEMA-04:** EntitySet identifiers must be unique and must not conflict with other collection identifiers in their namespace.

**SCHEMA-05:** Parent relationships must be acyclic.

**SCHEMA-06:** Relationship validation must support custom entity type inheritance.

**SCHEMA-07:** Unsupported schema versions must produce explicit errors.

**SCHEMA-08:** Unknown fields must produce actionable diagnostics unless explicitly permitted by a schema.

**SCHEMA-09:** YAML normalization must not depend on file traversal order.

**SCHEMA-10:** Future migrations must preserve canonical IDs.

---

## 4. Layout and Presentation Persistence

Diagram YAML defines the diagram's contents and default layout settings.

A separate `.layout.yaml` file stores diagram-specific presentation overrides.

### Layout precedence

1. Application defaults
2. Workspace defaults
3. Diagram defaults
4. Generated layout positions
5. Explicit layout-file position overrides

For ordinary scalar styling and spacing properties, higher-level explicit settings override lower-level defaults. Generated positions apply only to positioning.

### Layout reconciliation rules

**LAYOUT-16:** Existing manually positioned nodes retain compatible coordinates during normal model reloads.

**LAYOUT-17:** Newly introduced nodes receive generated positions without automatically replacing existing manual positions.

**LAYOUT-18:** Removed or renamed diagram instance references produce diagnostics if layout overrides remain.

**LAYOUT-19:** Automatic layout runs on explicit user action, not every render.

**LAYOUT-20:** Re-layout All allows users to regenerate all positions.

**LAYOUT-21:** Generated positions must be reproducible for identical input, configuration, and pinned layout-engine version.

**LAYOUT-22:** Manual layout changes must never modify canonical entity or relationship definitions.

**LAYOUT-23:** Saving layout overrides must not rewrite unrelated architecture files.

**LAYOUT-24:** Placement collisions introduced by partial layout regeneration should be minimized; unresolved collisions must not silently modify saved positions.

---

## 5. Filesystem Synchronization and Recovery

### External modification handling

**RELI-01:** Detect external changes to workspace YAML files.

**RELI-02:** Validate externally modified files before updating the active model.

**RELI-03:** Automatically refresh valid model changes when no conflicting local modifications exist.

**RELI-04:** Preserve the last valid model if an external reload fails, and clearly indicate that the displayed model is stale.

**RELI-05:** Display actionable file and schema diagnostics.

**RELI-06:** Detect conflicting changes using file revision information or content hashes.

**RELI-07:** Prevent silent overwrites of externally modified files.

### Persistence and recovery

**RELI-08:** Use temporary files and atomic replacement where supported.

**RELI-09:** Validate proposed changes before writing.

**RELI-10:** Distinguish unsaved editor state, autosaved drafts, and Git-committed revisions.

**RELI-11:** Recover compatible autosaved drafts after application interruption.

**RELI-12:** Preserve valid files when a write fails.

**RELI-13:** Detect orphaned architecture and diagram references following deletion.

**RELI-14:** Support workspace reload without restarting the application.

### Failure behavior

Malformed YAML must not cause an application crash.

A failed layout save must report the failure and retain recoverable unsaved changes.

External edits that conflict with local layout changes must require explicit resolution rather than automatic replacement.

File deletion, rename, permission failures, and interrupted saves must produce deterministic error behavior.

---

## 6. Local Application Security

The MVP does not require user authentication, but it must protect the local filesystem.

**SEC-01:** The local Next.js server binds to loopback by default.

**SEC-02:** File operations are restricted to explicitly configured workspace roots.

**SEC-03:** Path traversal outside a workspace is prohibited.

**SEC-04:** Unsafe symlink traversal is rejected.

**SEC-05:** YAML parsing must not execute arbitrary tags or application code.

**SEC-06:** Enforce reasonable YAML file-size and parsing-depth limits.

**SEC-07:** State-changing server operations must include appropriate request-origin protections.

**SEC-08:** Credentials and local secrets must not be stored in architecture YAML.

**SEC-09:** All filesystem access occurs through server-side repository services.

**SEC-10:** An unauthenticated MVP instance must not be exposed as a public service.

---

## 7. Automated Testing Strategy

Testing is required throughout implementation, not deferred to the final development epic.

### Test layers

| Layer | Technology | Purpose |
|---|---|---|
| Unit | Vitest | Domain and utility logic |
| Schema | Vitest + Zod | YAML contract validation |
| Property-based | fast-check | Model invariants and edge cases |
| Integration | Vitest + temp directories | Filesystem and workspace operations |
| Component | React Testing Library | Editor controls and diagnostics |
| Browser E2E | Playwright | User workflows |
| Visual regression | Playwright | Diagram rendering stability |
| Accessibility | axe-core | Automated accessibility checks |
| Performance | Benchmarks | Graph, layout, rendering, export |

### Coverage thresholds

| Category | Minimum |
|---|---|
| Critical domain logic | 95% |
| Overall codebase | 85% |
| Branch coverage | 85% |

Coverage is measured through Vitest's V8 coverage provider.

Thresholds must be enforced in CI. Critical persistence and validation logic must also have explicit negative-path and failure-injection tests.

Coverage percentages are minimum quality gates, not substitutes for meaningful assertions.

### Required Phase 0 test categories

**TEST-01: Parsing**
- Valid and invalid YAML.
- Missing required fields.
- Unsupported versions.
- Unsupported YAML types.
- Schema boundary values.

**TEST-02: Normalization**
- Individual versus grouped entities.
- File-order independence.
- Stable canonical IDs.
- Equivalent normalized model results.

**TEST-03: Validation**
- Duplicate IDs.
- Missing references.
- Cyclic hierarchies.
- Invalid relationships.
- Custom type inheritance.
- Diagram endpoint mismatches.

**TEST-04: Graph indexing**
- Incoming and outgoing relationships.
- Parent/child lookups.
- Entity-to-diagram references.
- Index rebuilding and deterministic results.

**TEST-05: Persistence**
- Round-trip serialization.
- External modification conflicts.
- Atomic writes.
- Write failures.
- Recovery after interruption.
- Unrelated-file preservation.

**TEST-06: Layout resolution**
- Configuration precedence.
- Manual positioning overrides.
- Removed and new nodes.
- Duplicate entity instances.
- Invalid layout references.
- Deterministic resolution.

**TEST-07: Security**
- Path traversal.
- Unsafe symlinks.
- Oversized YAML.
- Unauthorized filesystem targets.
- Unsafe request origins.

### Required Phase 1 E2E workflows

1. Load a valid YAML workspace and render a diagram.
2. Drag and align nodes, save, reload, and verify positions.
3. Change layout direction, spacing, and edge styles.
4. Modify YAML externally and verify reload behavior.
5. Export PNG and SVG diagrams and validate output.

### Visual regression testing

Capture controlled screenshots for:
- C4 System Context
- C4 Container
- C4 Component
- Network topology
- Deployment architecture
- Alternative edge styles
- Nested boundaries
- Large diagrams
- Error and diagnostic states

Use pinned browser versions, deterministic fixtures, consistent fonts, and fixed viewport sizes.

---

## 8. Performance Requirements

The following are provisional benchmarks to validate against a documented reference development machine.

| Operation | Target |
|---|---|
| Load 100 architecture entities | Under 1 second |
| Resolve 100 nodes and 150 edges | Under 200 ms |
| Auto-layout medium diagrams | Under 2 seconds |
| Node dragging | Approximately 60 FPS |
| Save layout YAML | Under 500 ms |
| Export a medium diagram | Under 5 seconds |

**PERF-01:** Establish repeatable benchmark fixtures.

**PERF-02:** Measure cold and warm workspace loading.

**PERF-03:** Benchmark layout operations with manual overrides.

**PERF-04:** Detect meaningful regressions in graph resolution and rendering.

**PERF-05:** Document reference hardware and test conditions.

---

## 9. Revised Phase 0 Implementation Backlog

| ID | Epic | Priority |
|---|---|---|
| P0-01 | Next.js application foundation and testing setup | P0 |
| P0-02 | Canonical TypeScript domain contracts | P0 |
| P0-03 | YAML schemas and normalization | P0 |
| P0-04 | Workspace discovery and secure file loading | P0 |
| P0-05 | Cross-resource validation | P0 |
| P0-06 | Architecture graph index | P0 |
| P0-07 | Diagram resolution | P0 |
| P0-08 | Layout configuration and serialization | P0 |
| P0-09 | Next.js domain service integration | P0 |
| P0-10 | Example workspaces and regression fixtures | P0 |
| P0-11 | File watching and safe workspace reload | P0 |
| P0-12 | Persistence conflict detection and failure recovery | P0 |
| P0-13 | Test coverage, performance baselines, and CI enforcement | P0 |

### Additional implementation requirements

Every epic must include:
- Automated happy-path tests.
- Automated invalid-input and error-path tests.
- Integration tests where filesystem or service boundaries are involved.
- Documented acceptance criteria.
- No unhandled TypeScript errors.
- Passing lint and formatting checks.
- Passing relevant coverage thresholds.

P0-13 establishes shared test tooling and quality gates, but testing remains part of every epic.

---

## 10. CI Quality Gates

Each pull request must execute:

1. Formatting and lint checks.
2. TypeScript type checking.
3. Domain unit tests.
4. Schema and property-based tests.
5. Filesystem integration tests.
6. Coverage threshold validation.
7. Production build verification.
8. Relevant Playwright smoke tests once the UI exists.

Required checks must pass before merging.

---

## 11. Revised Implementation Phases

### Phase 0 — Reliable YAML Model Foundation

Canonical domain contracts, YAML loading, normalization, validation, indexing, file synchronization, safe persistence, and automated testing infrastructure.

**Exit criterion:** A YAML workspace can be loaded, validated, changed externally, indexed, and safely persisted with deterministic behavior and automated test coverage.

### Phase 1 — Diagram Viewer and Layout Editor

React Flow integration, C4/network/deployment rendering, ELK.js layouts, node positioning, alignment, grid snapping, edge styling, layout persistence, and PNG/SVG export.

**Exit criterion:** A user can visually arrange YAML-defined architecture diagrams without modifying the canonical architecture model.

### Phase 2 — Architecture Documentation and ADRs

Markdown documents, structured ADRs, entity traceability, supersession, reverse references, and documentation navigation.

### Phase 3 — Advanced Diagrams and Flows

Custom diagrams, structured flow models, flowcharts, sequence diagrams, and advanced grouping.

### Phase 4 — Versioning and GitHub

Revision comparisons, semantic diffs, recovery, Git branches, commits, PR integration, and validation workflows.

### Phase 5 — Team Collaboration

Authentication, RBAC, workspace permissions, team sharing, and multi-tenant capabilities.

---

## 12. Phase 0 Definition of Done

Phase 0 is complete only when:

- Both `Entity` and `EntitySet` formats work correctly.
- All v1 resource schemas validate.
- Entity and relationship references resolve correctly.
- Duplicate IDs, invalid hierarchies, and broken relationships produce diagnostics.
- Diagram definitions resolve to normalized renderable data.
- Diagram and layout configuration precedence is deterministic.
- External YAML changes are detected and safely reloaded.
- Invalid reloads preserve the last valid model.
- Conflicting writes cannot silently overwrite user changes.
- Layout files can be written and recovered safely.
- Filesystem security controls are tested.
- Core domain coverage meets the established thresholds.
- CI quality gates pass.
- A complete example workspace passes integration testing.

---

## 13. Future Requirements

The following remain intentionally outside the MVP:

- Creating and deleting architecture entities visually.
- Visual relationship creation.
- Real-time collaboration.
- Authentication and RBAC.
- Hosted multi-tenant deployments.
- Advanced Git merge management.
- External diagram imports.
- Automatic cloud infrastructure discovery.
- Additional source control providers.
- Fully configurable diagram rendering engines.

Future requirements must preserve compatibility with the canonical model and versioned YAML schema.

---

**Document status:** PRD v1.6 — approved requirements baseline, ready for Phase 0 technical implementation.
