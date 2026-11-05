# Automated Testing Strategy

Source: PRD §7. Conventions: [checklists/README.md](README.md).

## Test layers in place

- [ ] **LAYER-01** — Unit: Vitest
- [ ] **LAYER-02** — Schema: Vitest + Zod
- [ ] **LAYER-03** — Property-based: fast-check
- [ ] **LAYER-04** — Integration: Vitest + temp directories
- [ ] **LAYER-05** — Component: React Testing Library
- [ ] **LAYER-06** — Browser E2E: Playwright
- [ ] **LAYER-07** — Visual regression: Playwright
- [ ] **LAYER-08** — Accessibility: axe-core
- [ ] **LAYER-09** — Performance: benchmarks

## Coverage thresholds (Vitest V8, enforced in CI)

- [ ] **COV-01** — Critical domain logic ≥ 95%
- [ ] **COV-02** — Overall codebase ≥ 85%
- [ ] **COV-03** — Branch coverage ≥ 85%
- [ ] **COV-04** — Negative-path and failure-injection tests for persistence and validation logic

## Phase 0 test categories

- [ ] **TEST-01** Parsing
  - [ ] Valid and invalid YAML
  - [ ] Missing required fields
  - [ ] Unsupported versions
  - [ ] Unsupported YAML types
  - [ ] Schema boundary values
- [ ] **TEST-02** Normalization
  - [ ] Individual vs grouped entities
  - [ ] File-order independence
  - [ ] Stable canonical IDs
  - [ ] Equivalent normalized model results
- [ ] **TEST-03** Validation
  - [ ] Duplicate IDs
  - [ ] Missing references
  - [ ] Cyclic hierarchies
  - [ ] Invalid relationships
  - [ ] Custom type inheritance
  - [ ] Diagram endpoint mismatches
- [ ] **TEST-04** Graph indexing
  - [ ] Incoming and outgoing relationships
  - [ ] Parent/child lookups
  - [ ] Entity-to-diagram references
  - [ ] Index rebuilding and deterministic results
- [ ] **TEST-05** Persistence
  - [ ] Round-trip serialization
  - [ ] External modification conflicts
  - [ ] Atomic writes
  - [ ] Write failures
  - [ ] Recovery after interruption
  - [ ] Unrelated-file preservation
- [ ] **TEST-06** Layout resolution
  - [ ] Configuration precedence
  - [ ] Manual positioning overrides
  - [ ] Removed and new nodes
  - [ ] Duplicate entity instances
  - [ ] Invalid layout references
  - [ ] Deterministic resolution
- [ ] **TEST-07** Security
  - [ ] Path traversal
  - [ ] Unsafe symlinks
  - [ ] Oversized YAML
  - [ ] Unauthorized filesystem targets
  - [ ] Unsafe request origins

## Phase 1 E2E workflows (Playwright)

- [ ] **E2E-01** — Load a valid YAML workspace and render a diagram
- [ ] **E2E-02** — Drag and align nodes, save, reload, verify positions
- [ ] **E2E-03** — Change layout direction, spacing, and edge styles
- [ ] **E2E-04** — Modify YAML externally and verify reload behavior
- [ ] **E2E-05** — Export PNG and SVG and validate output

## Visual regression snapshots

Pinned browsers, deterministic fixtures, consistent fonts, fixed viewports.

- [ ] **VR-01** — C4 System Context
- [ ] **VR-02** — C4 Container
- [ ] **VR-03** — C4 Component
- [ ] **VR-04** — Network topology
- [ ] **VR-05** — Deployment architecture
- [ ] **VR-06** — Alternative edge styles
- [ ] **VR-07** — Nested boundaries
- [ ] **VR-08** — Large diagrams
- [ ] **VR-09** — Error and diagnostic states
