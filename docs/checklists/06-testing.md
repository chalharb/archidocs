# Automated Testing Strategy

Source: PRD §7. Conventions: [checklists/README.md](README.md).

## Test layers in place

- [x] **LAYER-01** — Unit: Vitest — ✅ vitest `unit` project (5fa9462)
- [x] **LAYER-02** — Schema: Vitest + Zod — ✅ src/domain/schema/resource-schemas.test.ts (ab89aac)
- [x] **LAYER-03** — Property-based: fast-check — ✅ fast-check in normalize/parse/hierarchy/layout/graph-index tests (71ac6c9)
- [x] **LAYER-04** — Integration: Vitest + temp directories — ✅ vitest `integration` project, tests/helpers/tmp.ts (0b9418e)
- [x] **LAYER-05** — Component: React Testing Library — ✅ src/components/workspace-summary.test.tsx (376c8e5)
- [x] **LAYER-06** — Browser E2E: Playwright — ✅ playwright.config.ts, tests/e2e/smoke.spec.ts (0a913ee)
- [x] **LAYER-07** — Visual regression: Playwright — ✅ tests/e2e/visual.spec.ts, playwright.config.ts (05ad960)
- [x] **LAYER-08** — Accessibility: axe-core — ✅ @axe-core/playwright in tests/e2e/smoke.spec.ts (0a913ee)
- [x] **LAYER-09** — Performance: benchmarks — ✅ tests/bench/workspace.bench.ts, tests/integration/performance.test.ts (88dcfeb)

## Coverage thresholds (Vitest V8, enforced in CI)

- [x] **COV-01** — Critical domain logic ≥ 95% — ✅ src/domain/** branches 95.36%, lines 99.8%; enforced by vitest.config.mts thresholds (c72d633)
- [x] **COV-02** — Overall codebase ≥ 85% — ✅ overall statements 98.5%, lines 99.2% (c72d633)
- [x] **COV-03** — Branch coverage ≥ 85% — ✅ overall branches 95.2% (c72d633)
- [x] **COV-04** — Negative-path and failure-injection tests for persistence and validation logic — ✅ fs.integration.test.ts › failure injection, persistence.integration.test.ts, validate.test.ts (0b9418e, 61a78db)

## Phase 0 test categories

- [x] **TEST-01** Parsing — ✅ src/domain/parse.test.ts, src/domain/schema/resource-schemas.test.ts
  - [x] Valid and invalid YAML
  - [x] Missing required fields
  - [x] Unsupported versions
  - [x] Unsupported YAML types
  - [x] Schema boundary values
- [x] **TEST-02** Normalization — ✅ src/domain/normalize.test.ts
  - [x] Individual vs grouped entities
  - [x] File-order independence
  - [x] Stable canonical IDs
  - [x] Equivalent normalized model results
- [x] **TEST-03** Validation — ✅ src/domain/validate.test.ts, src/domain/diagram-resolve.test.ts
  - [x] Duplicate IDs
  - [x] Missing references
  - [x] Cyclic hierarchies
  - [x] Invalid relationships
  - [x] Custom type inheritance
  - [x] Diagram endpoint mismatches
- [x] **TEST-04** Graph indexing — ✅ src/domain/graph-index.test.ts
  - [x] Incoming and outgoing relationships
  - [x] Parent/child lookups
  - [x] Entity-to-diagram references
  - [x] Index rebuilding and deterministic results
- [x] **TEST-05** Persistence — ✅ src/server/persistence/persistence.integration.test.ts, src/server/fs/fs.integration.test.ts, repository.integration.test.ts
  - [x] Round-trip serialization
  - [x] External modification conflicts
  - [x] Atomic writes
  - [x] Write failures
  - [x] Recovery after interruption
  - [x] Unrelated-file preservation
- [x] **TEST-06** Layout resolution — ✅ src/domain/layout/layout.test.ts
  - [x] Configuration precedence
  - [x] Manual positioning overrides
  - [x] Removed and new nodes
  - [x] Duplicate entity instances
  - [x] Invalid layout references
  - [x] Deterministic resolution
- [x] **TEST-07** Security — ✅ src/server/fs/fs.integration.test.ts, src/server/http/request-guard.test.ts, handlers.integration.test.ts
  - [x] Path traversal
  - [x] Unsafe symlinks
  - [x] Oversized YAML
  - [x] Unauthorized filesystem targets
  - [x] Unsafe request origins

## Phase 1 E2E workflows (Playwright)

- [x] **E2E-01** — Load a valid YAML workspace and render a diagram — ✅ tests/e2e/editor.spec.ts › E2E-01 (3765da0)
- [x] **E2E-02** — Drag and align nodes, save, reload, verify positions — ✅ tests/e2e/editor.spec.ts › E2E-02 (3765da0)
- [x] **E2E-03** — Change layout direction, spacing, and edge styles — ✅ tests/e2e/editor.spec.ts › E2E-03 (3765da0)
- [x] **E2E-04** — Modify YAML externally and verify reload behavior — ✅ tests/e2e/editor.spec.ts › E2E-04 (3765da0)
- [x] **E2E-05** — Export PNG and SVG and validate output — ✅ tests/e2e/editor.spec.ts › E2E-05 (3765da0)

## Visual regression snapshots

Pinned browsers, deterministic fixtures, consistent fonts, fixed viewports.

- [x] **VR-01** — C4 System Context (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-01 (05ad960)
- [x] **VR-02** — C4 Container (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-02 (05ad960)
- [x] **VR-03** — C4 Component (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-03 (05ad960)
- [x] **VR-04** — Network topology (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-04 (05ad960)
- [x] **VR-05** — Deployment architecture (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-05 (05ad960)
- [x] **VR-06** — Alternative edge styles (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-06 (05ad960)
- [x] **VR-07** — Nested boundaries (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-07 (05ad960)
- [x] **VR-08** — Large diagrams (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-08 (05ad960)
- [x] **VR-09** — Error and diagnostic states (styled per ADD-004) — ✅ tests/e2e/visual.spec.ts › VR-09 (05ad960)
