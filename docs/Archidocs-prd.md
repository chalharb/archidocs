# Architecture Docs — Product Requirements Document

**Version:** 1.7  
**Status:** Approved requirements baseline  
**Technology:** Next.js, TypeScript, React Flow, ELK.js  
**Deployment:** Local-first, single tenant  
**Source of truth:** YAML files  
**Authentication:** Not required for MVP

> **This baseline is frozen.** Changes are recorded as addenda in [`addenda/`](addenda/README.md). Effective requirements = this document + all accepted addenda numbered after ADD-008. Progress is tracked in [`checklists/`](checklists/README.md). See [`README.md`](README.md) for the workflow.

### Changes from v1.6

v1.7 consolidates the accepted addenda ADD-001 to ADD-008. The addenda remain in [`addenda/`](addenda/README.md) as the record of why each change was made.

| Addendum | Change | Where |
|---|---|---|
| [ADD-001](addenda/ADD-001-archdocs-v1-schema.md) | Field-level `archdocs/v1` schema | §3 |
| [ADD-002](addenda/ADD-002-defer-git-revision-state.md) | Git-committed revision state deferred to Phase 4 (RELI-10, RELI-15) | §5 |
| [ADD-003](addenda/ADD-003-defer-github-ci.md) | Hosted CI deferred until a GitHub remote exists | §9, §10, §12 |
| [ADD-004](addenda/ADD-004-element-and-relationship-styles.md) | Element and relationship styles (DIAG-11) | §2.2, §3 |
| [ADD-005](addenda/ADD-005-animated-edge-flow.md) | Optional animated edges (LAYOUT-25) | §2.3, §4 |
| [ADD-006](addenda/ADD-006-nested-boundary-semantics.md) | Nested boundary membership and absolute layout coordinates (LAYOUT-14) | §2.3, §4 |
| [ADD-007](addenda/ADD-007-separate-view-and-edit-routes.md) | Separate view and edit routes (DIAG-12) | §2.2 |
| [ADD-008](addenda/ADD-008-optional-minimap.md) | Optional minimap (LAYOUT-26) | §2.3, §4 |

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
| DIAG-11 | Element and relationship styles (node shape and colour; line style and colour), declared on types and elements and rendered consistently in every diagram | P0 |
| DIAG-12 | Separate read-only view route and layout edit route per diagram | P1 |

#### Element and relationship styles (DIAG-11)

Entity types, relationship types, entities and relationships can declare a `style` (§3). Each key resolves independently, later wins:

1. Built-in defaults: `rectangle` / `primary` for elements, `dashed` / `gray` for relationships.
2. Type ancestry, from the root type down to the element's own type (`extends` chain).
3. The entity's or relationship's own `style`.

Styles are resolved per element, so every view instance of an entity (DIAG-09) looks the same. The editor never writes `style`; styles change only by editing YAML. Icons and per-diagram style overrides are out of scope.

#### View and edit routes (DIAG-12)

| Route | Purpose |
|---|---|
| `/workspaces/<key>/diagrams/<id>` | **View** (default). Full-width canvas with pan, zoom, fit to view, the minimap if enabled, inspection, export, and diagnostics collapsed to a status indicator (a stale model is always visible). Nodes can't be moved. Live reload applies. |
| `/workspaces/<key>/diagrams/<id>/edit` | **Edit**: the layout editor. **Done** returns to the view, asking first if there are unsaved changes. |

**Edit layout** is disabled, with the reason, when the layout file isn't writable. "Edit" is a mode, not access control. Related-diagram links open in view mode.

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
| LAYOUT-10 | Minimap (optional, LAYOUT-26), zoom, pan, and fit-to-view | P0 |
| LAYOUT-11 | Preserve compatible positions when models change | P0 |
| LAYOUT-12 | Explicit Re-layout All operation | P0 |
| LAYOUT-13 | Report orphaned layout references | P0 |
| LAYOUT-14 | Support nested boundaries and grouping | P1 |
| LAYOUT-15 | Export PNG and SVG diagrams | P0 |
| LAYOUT-25 | Optional animated edges showing flow from source to target: off by default, configurable per diagram and per edge, static when the system requests reduced motion, never animated in exports | P1 |
| LAYOUT-26 | Show or hide the minimap: shown by default, configurable per workspace, diagram and layout file, on both routes, never in exports | P1 |

**Nested boundaries (LAYOUT-14).** A diagram node is drawn inside a boundary when the nearest ancestor of its entity (following `parent`) that the diagram also shows appears there as exactly one view instance; that node becomes the boundary. Ancestors the diagram doesn't show are skipped. When the nearest shown ancestor has several view instances (DIAG-09), the node isn't nested. ELK lays out boundaries as compound nodes sized to fit their contents.

**Animated edges (LAYOUT-25).** Motion runs from the relationship's source to its target. Animation must not push node dragging below about 60 FPS on the medium benchmark diagram; if it would, it pauses while dragging.

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

The authoritative machine-readable definition is [`src/domain/schema/resource-schemas.ts`](../src/domain/schema/resource-schemas.ts). A complete example is in [`examples/sample-workspace/`](../examples/sample-workspace/).

### Common rules

- Every YAML document is one resource with `apiVersion: archdocs/v1` and `kind: <Kind>`. Files may hold several documents separated by `---`. Empty documents are ignored.
- Fields are flat on the resource (no `metadata`/`spec` split), so an `Entity` resource and an `EntitySet` entry have identical shapes (SCHEMA-02).
- **IDs** match `^[A-Za-z0-9][A-Za-z0-9._-]*$`, 1–128 characters, case-sensitive, and are never rewritten (MODEL-08).
- **Strictness:** unknown fields are errors with a "did you mean" hint (SCHEMA-08). The only open-ended field is `properties`, a map of JSON-compatible values for custom metadata (MODEL-05). The keys `__proto__`, `constructor` and `prototype` are rejected everywhere.
- **Limits** (SEC-06): 1 MiB per file, 500 documents per file, nesting depth 32, 100 alias expansions per document, 5,000 YAML files and 32 directory levels per workspace. Names ≤ 200 characters, descriptions ≤ 10,000, ≤ 64 tags of ≤ 64 characters, ≤ 10,000 items per set or diagram list.
- **YAML features:** YAML 1.2 core schema only. Any tag outside `str/int/float/bool/null/map/seq` is rejected (SEC-05). Dates stay strings. Merge keys (`<<`) are not supported.
- Unsupported `apiVersion` values produce `SCHEMA_UNSUPPORTED_VERSION` (SCHEMA-07).
- Any field change needs either an additive change accepted by an addendum or a new `apiVersion` with a migration (SCHEMA-10, [schema-migrations.md](schema-migrations.md)).

### Resource kinds

| Kind | Required | Optional |
|---|---|---|
| `Workspace` | `id`, `name` | `description`, `defaults.layout` (layout settings) |
| `Project` | `id`, `name` | `description`, `owner`, `tags`, `properties` |
| `Entity` | `id`, `name`, `type` | `description`, `parent`, `project`, `technology`, `owner`, `tags`, `properties`, `style` |
| `EntitySet` | `id`, `entities[]` (each with the `Entity` fields above) | `name`, `description` |
| `EntityType` | `id`, `name` | `description`, `extends`, `style` |
| `RelationshipType` | `id`, `name` | `description`, `extends`, `sources[]`, `targets[]` (allowed entity types), `style` |
| `RelationshipSet` | `id`, `relationships[]` (`id`, `type`, `source`, `target`; optional `description`, `technology`, `tags`, `properties`, `style`) | `name`, `description` |
| `Diagram` | `id`, `name`, `diagramType`, `nodes[]` | `description`, `layout` (settings), `edges[]` |
| `DiagramLayout` | `diagram` | `settings`, `nodes` (map of node ID → `{x, y, width?, height?}`), `edges` (map of edge ID → `{type?, animated?}`) |

- `diagramType` is one of `c4-context`, `c4-container`, `c4-component`, `network`, `deployment`, `custom`.
- Diagram `nodes[]` entries are view instances: `{entity, id?, label?}`; `id` defaults to `entity`. One entity may appear several times with distinct IDs (DIAG-09).
- Diagram `edges[]` entries are `{relationship, id?, source?, target?, label?}`; `id` defaults to `relationship`; `source`/`target` name view instances and are required only when the relationship's entity appears more than once.
- **Layout settings:** `direction` (`DOWN|UP|LEFT|RIGHT`), `nodeSpacing` and `layerSpacing` (0–1000), `edgeType` (`straight|bezier|step|smoothstep`), `gridSize` (integer 1–200), `snapToGrid`, `nodeWidth` and `nodeHeight` (10–2000), `animateEdges` (LAYOUT-25), `showMinimap` (LAYOUT-26). Coordinates are within ±1,000,000.
- **Styles** (DIAG-11), all keys optional and strict:
  - Element `style` (on `EntityType` and `Entity`): `shape` (`rectangle|person|cylinder|storage|queue|browser|mobile`) and `color`.
  - Relationship `style` (on `RelationshipType` and relationships): `line` (`solid|dashed|dotted`) and `color`.
  - Colours are palette names, not hex values, so themes can define them accessibly: `primary`, `secondary`, `muted`, `slate`, `gray`, `blue`, `indigo`, `sky`, `green`, `amber`, `red`.

### Semantics

- **Entity types are user-defined.** There are no built-in types. `extends` gives single inheritance (SCHEMA-06).
- **Relationship type constraints** (`sources`/`targets`) accept the listed entity types and their subtypes. A relationship type inherits constraints from the nearest ancestor that sets them. Omitted constraints accept any entity.
- **ID categories** (SCHEMA-03): entities (from `Entity` and `EntitySet`), relationships, diagrams, entity types, relationship types and projects are each unique workspace-wide; the same ID may be reused across categories. `EntitySet` and `RelationshipSet` IDs share one collection namespace (SCHEMA-04). One `Workspace` resource per root; one `DiagramLayout` per diagram.
- **Duplicates** keep the definition with the smallest (file path, document index, item index) and report the others, so the outcome never depends on traversal order (SCHEMA-09).
- **Layout files** live next to their diagram as `<diagram-id>.layout.yaml`, or wherever an existing `DiagramLayout` for that diagram already is. The application writes a layout only when its file contains nothing but that `DiagramLayout` (LAYOUT-23); otherwise saving reports `NOT_WRITABLE`. Layout files are written deterministically (sorted keys, two-decimal coordinates) with a header comment.
- **Orphaned overrides** (node/edge IDs not in the diagram, or layouts for unknown diagrams) are warnings, not errors, so they don't block a reload (LAYOUT-18).
- **Credential-like property keys** (`password`, `secret`, `token`, `apiKey`, `privateKey`, `credential`, `accessKey`, any case/separator) produce `SECRET_SUSPECTED` warnings (SEC-08).
- **Discovery** reads `*.yaml`/`*.yml` under the root, skipping hidden entries (`.git`, `.archidoc`, …) and `node_modules`.

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

Every layout setting (§3), including `animateEdges` and `showMinimap`, can be set in `Workspace.defaults.layout`, `Diagram.layout`, or a layout file's `settings`. A layout file's per-edge `type` and `animated` override the resolved setting for that edge.

### Layout coordinates

Every `nodes` entry in `.layout.yaml` uses absolute canvas coordinates, including nodes inside a boundary. A boundary's `width` and `height` are saved with its position. Moving a boundary in the editor moves its contents, and the editor saves the new absolute positions of all of them. During partial regeneration, a new node inside a manually placed boundary is positioned relative to that boundary, and a generated node is never reported as colliding with its own boundary.

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

**RELI-10:** Distinguish unsaved editor state, autosaved drafts, and saved file revisions (content hashes). Distinguishing Git-committed revisions is deferred to Phase 4 (RELI-15).

**RELI-11:** Recover compatible autosaved drafts after application interruption.

**RELI-12:** Preserve valid files when a write fails.

**RELI-13:** Detect orphaned architecture and diagram references following deletion.

**RELI-14:** Support workspace reload without restarting the application.

**RELI-15** (Phase 4): Distinguish Git-committed revisions from saved but uncommitted file revisions.

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

Workflows 2–4 run on the edit route; 1 and 5 run on the view route (DIAG-12).

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

Use pinned browser versions, deterministic fixtures, consistent fonts, and fixed viewport sizes. Snapshots use the styled components (DIAG-11), are captured on the view route with animation disabled, and include one snapshot of the editor chrome and one of an animated edge rendered static under reduced motion.

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
| P0-13 | Test coverage, performance baselines, and CI enforcement (enforced locally while hosted CI is deferred, §10) | P0 |

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

**Deferred until the repository has a GitHub remote** (CI-01..08 and the required-checks rule). The gates are defined in `.github/workflows/ci.yml` and run locally through `pnpm check` and `pnpm build && pnpm test:e2e`. Until hosted CI exists, merge into `main` only when both pass. When a remote is added: open a pull request so the workflow runs, reinstate CI-01..08 in checklist 08 with the run as evidence, and require the `quality`, `test` and `build-e2e` jobs through branch protection. No further addendum is needed to reinstate them.

---

## 11. Revised Implementation Phases

### Phase 0 — Reliable YAML Model Foundation

Canonical domain contracts, YAML loading, normalization, validation, indexing, file synchronization, safe persistence, and automated testing infrastructure.

**Exit criterion:** A YAML workspace can be loaded, validated, changed externally, indexed, and safely persisted with deterministic behavior and automated test coverage.

**Status:** complete ([phase-0-acceptance.md](phase-0-acceptance.md)).

### Phase 1 — Diagram Viewer and Layout Editor

React Flow integration, C4/network/deployment rendering, ELK.js layouts, node positioning, alignment, grid snapping, edge styling, layout persistence, and PNG/SVG export.

**Exit criterion:** A user can visually arrange YAML-defined architecture diagrams without modifying the canonical architecture model.

**Status:** complete ([phase-1-acceptance.md](phase-1-acceptance.md)).

### Phase 2 — Architecture Documentation and ADRs

Markdown documents, structured ADRs, entity traceability, supersession, reverse references, and documentation navigation.

Like each later phase, Phase 2 is only outlined here. Its detailed requirements are defined by an addendum before work starts.

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
- CI quality gates pass (locally while hosted CI is deferred, §10).
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

**Document status:** PRD v1.7 — approved requirements baseline consolidating ADD-001 to ADD-008. Phases 0 and 1 are complete; ready for Phase 2 requirements definition.
