# Architecture Model and YAML Schema

Source: PRD §2.1, §3. Conventions: [checklists/README.md](README.md).

## Architecture Repository (§2.1)

- [ ] **MODEL-01** `P0` `Phase 0` — Support individual `Entity` YAML resources
- [ ] **MODEL-02** `P0` `Phase 0` — Support grouped `EntitySet` YAML resources
- [ ] **MODEL-03** `P0` `Phase 0` — Normalize both entity formats into one canonical model
- [ ] **MODEL-04** `P0` `Phase 0` — Support typed, directional relationships
- [ ] **MODEL-05** `P0` `Phase 0` — Support standard and custom entity metadata
- [ ] **MODEL-06** `P0` `Phase 0` — Support configurable entity and relationship type definitions
- [ ] **MODEL-07** `P0` `Phase 0` — Validate schemas and references
- [ ] **MODEL-08** `P0` `Phase 0` — Maintain stable canonical identifiers
- [ ] **MODEL-09** `P0` `Phase 0` — Support reusable entities across diagrams
- [ ] **MODEL-10** `P0` `Phase 0` — Detect invalid hierarchies and duplicate identifiers

## `archdocs/v1` resource kinds (§3)

Each kind needs a strict schema, valid and invalid fixtures, and tests.

- [ ] **KIND-Workspace** — `Workspace`
- [ ] **KIND-Project** — `Project`
- [ ] **KIND-Entity** — `Entity`
- [ ] **KIND-EntitySet** — `EntitySet`
- [ ] **KIND-EntityType** — `EntityType`
- [ ] **KIND-RelationshipSet** — `RelationshipSet`
- [ ] **KIND-RelationshipType** — `RelationshipType`
- [ ] **KIND-Diagram** — `Diagram`
- [ ] **KIND-DiagramLayout** — `DiagramLayout`

## Schema consistency (§3)

- [ ] **SCHEMA-01** `Phase 0` — Each resource kind has a strict validation schema
- [ ] **SCHEMA-02** `Phase 0` — Individual and grouped entities normalize to identical internal representations
- [ ] **SCHEMA-03** `Phase 0` — Entity, relationship, and diagram IDs are unique within the workspace per category
- [ ] **SCHEMA-04** `Phase 0` — EntitySet IDs are unique and don't conflict with other collection IDs in their namespace
- [ ] **SCHEMA-05** `Phase 0` — Parent relationships are acyclic
- [ ] **SCHEMA-06** `Phase 0` — Relationship validation supports custom entity type inheritance
- [ ] **SCHEMA-07** `Phase 0` — Unsupported schema versions produce explicit errors
- [ ] **SCHEMA-08** `Phase 0` — Unknown fields produce actionable diagnostics unless the schema permits them
- [ ] **SCHEMA-09** `Phase 0` — YAML normalization doesn't depend on file traversal order
- [ ] **SCHEMA-10** `Phase 0` — Future migrations preserve canonical IDs (migration design documented and tested)
