# Architecture Model and YAML Schema

Source: PRD §2.1, §3. Conventions: [checklists/README.md](README.md).

## Architecture Repository (§2.1)

- [x] **MODEL-01** `P0` `Phase 0` — Support individual `Entity` YAML resources — ✅ src/domain/parse.test.ts, src/domain/normalize.test.ts (71ac6c9)
- [x] **MODEL-02** `P0` `Phase 0` — Support grouped `EntitySet` YAML resources — ✅ src/domain/normalize.test.ts (71ac6c9)
- [x] **MODEL-03** `P0` `Phase 0` — Normalize both entity formats into one canonical model — ✅ src/domain/normalize.test.ts › identical representations (71ac6c9)
- [x] **MODEL-04** `P0` `Phase 0` — Support typed, directional relationships — ✅ RelationshipSet + typed relationship validation, src/domain/validate.test.ts (0f11a18)
- [x] **MODEL-05** `P0` `Phase 0` — Support standard and custom entity metadata — ✅ `properties` map + standard fields, src/domain/parse.test.ts › permits arbitrary keys (71ac6c9)
- [x] **MODEL-06** `P0` `Phase 0` — Support configurable entity and relationship type definitions — ✅ EntityType/RelationshipType with inheritance + constraints, src/domain/validate.test.ts (0f11a18)
- [x] **MODEL-07** `P0` `Phase 0` — Validate schemas and references — ✅ src/domain/validate.test.ts, tests/integration/invalid-fixtures.test.ts (0f11a18, cdb3aa7)
- [x] **MODEL-08** `P0` `Phase 0` — Maintain stable canonical identifiers — ✅ src/domain/normalize.test.ts › keeps canonical IDs exactly as authored (71ac6c9)
- [x] **MODEL-09** `P0` `Phase 0` — Support reusable entities across diagrams — ✅ examples/sample-workspace (entities reused across 6 diagrams), src/domain/graph-index.test.ts (6ba9f61)
- [x] **MODEL-10** `P0` `Phase 0` — Detect invalid hierarchies and duplicate identifiers — ✅ src/domain/validate.test.ts › hierarchies, src/domain/normalize.test.ts › duplicates (0f11a18)

## `archdocs/v1` resource kinds (§3)

Each kind needs a strict schema, valid and invalid fixtures, and tests.

- [x] **KIND-Workspace** — `Workspace` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-Project** — `Project` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-Entity** — `Entity` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-EntitySet** — `EntitySet` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-EntityType** — `EntityType` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-RelationshipSet** — `RelationshipSet` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-RelationshipType** — `RelationshipType` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-Diagram** — `Diagram` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)
- [x] **KIND-DiagramLayout** — `DiagramLayout` — ✅ src/domain/schema/resource-schemas.test.ts, examples/sample-workspace, tests/fixtures/invalid (ab89aac); schema per ADD-001 (Proposed)

## Schema consistency (§3)

- [x] **SCHEMA-01** `Phase 0` — Each resource kind has a strict validation schema — ✅ src/domain/schema/resource-schemas.test.ts (ab89aac)
- [x] **SCHEMA-02** `Phase 0` — Individual and grouped entities normalize to identical internal representations — ✅ src/domain/normalize.test.ts (71ac6c9)
- [x] **SCHEMA-03** `Phase 0` — Entity, relationship, and diagram IDs are unique within the workspace per category — ✅ src/domain/normalize.test.ts › TEST-03 duplicates (71ac6c9)
- [x] **SCHEMA-04** `Phase 0` — EntitySet IDs are unique and don't conflict with other collection IDs in their namespace — ✅ src/domain/normalize.test.ts › collection ID conflicts (71ac6c9)
- [x] **SCHEMA-05** `Phase 0` — Parent relationships are acyclic — ✅ src/domain/validate.test.ts › hierarchies, src/domain/hierarchy.test.ts (0f11a18)
- [x] **SCHEMA-06** `Phase 0` — Relationship validation supports custom entity type inheritance — ✅ src/domain/validate.test.ts › endpoint types with inheritance (0f11a18)
- [x] **SCHEMA-07** `Phase 0` — Unsupported schema versions produce explicit errors — ✅ src/domain/parse.test.ts › unsupported version (71ac6c9)
- [x] **SCHEMA-08** `Phase 0` — Unknown fields produce actionable diagnostics unless the schema permits them — ✅ src/domain/parse.test.ts › unknown fields (71ac6c9)
- [x] **SCHEMA-09** `Phase 0` — YAML normalization doesn't depend on file traversal order — ✅ src/domain/normalize.test.ts › file-order independence, fast-check (71ac6c9)
- [ ] **SCHEMA-10** `Phase 0` — Future migrations preserve canonical IDs (migration design documented and tested)
