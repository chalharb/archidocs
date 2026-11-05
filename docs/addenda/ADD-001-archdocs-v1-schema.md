# ADD-001: Field-level definition of the `archdocs/v1` schema

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Clarification |
| **Proposed** | 2026-11-05 by Claude (Phase 0 implementation) |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.6 |
| **Affected IDs** | MODEL-01..10, SCHEMA-01..09, LAYOUT-08, LAYOUT-18, LAYOUT-23, SEC-06, SEC-08 |
| **PRD sections** | §2.1, §3, §4, §6 |

## Context

PRD §3 names the nine `archdocs/v1` resource kinds but does not define their fields, ID rules, file layout, duplicate-resolution rules or limits. Phase 0 needs a concrete, strict schema (SCHEMA-01), so the implementation had to choose one. This addendum records those choices so they can be reviewed and accepted rather than living only in code.

The authoritative machine-readable definition is [`src/domain/schema/resource-schemas.ts`](../../src/domain/schema/resource-schemas.ts); TypeScript contracts are in [`src/domain/resources.ts`](../../src/domain/resources.ts). A complete example is in [`examples/sample-workspace/`](../../examples/sample-workspace/).

## Change

### Common rules

- Every YAML document is one resource with `apiVersion: archdocs/v1` and `kind: <Kind>`. Files may hold several documents separated by `---`. Empty documents are ignored.
- Fields are flat on the resource (no `metadata`/`spec` split), so an `Entity` resource and an `EntitySet` entry have identical shapes (SCHEMA-02).
- **IDs** match `^[A-Za-z0-9][A-Za-z0-9._-]*$`, 1–128 characters, case-sensitive, and are never rewritten (MODEL-08).
- **Strictness:** unknown fields are errors with a "did you mean" hint (SCHEMA-08). The only open-ended field is `properties`, a map of JSON-compatible values for custom metadata (MODEL-05). The keys `__proto__`, `constructor` and `prototype` are rejected everywhere.
- **Limits** (SEC-06): 1 MiB per file, 500 documents per file, nesting depth 32, 100 alias expansions per document, 5,000 YAML files and 32 directory levels per workspace. Names ≤ 200 characters, descriptions ≤ 10,000, ≤ 64 tags of ≤ 64 characters, ≤ 10,000 items per set or diagram list.
- **YAML features:** YAML 1.2 core schema only. Any tag outside `str/int/float/bool/null/map/seq` (e.g. `!!binary`, `!!set`, `!!timestamp`, `!custom`) is rejected (SEC-05). Dates stay strings. Merge keys (`<<`) are not supported.
- Unsupported `apiVersion` values (including `archdocs/v2`) produce `SCHEMA_UNSUPPORTED_VERSION` (SCHEMA-07).

### Resource kinds

| Kind | Required | Optional |
|---|---|---|
| `Workspace` | `id`, `name` | `description`, `defaults.layout` (layout settings) |
| `Project` | `id`, `name` | `description`, `owner`, `tags`, `properties` |
| `Entity` | `id`, `name`, `type` | `description`, `parent`, `project`, `technology`, `owner`, `tags`, `properties` |
| `EntitySet` | `id`, `entities[]` (each with the `Entity` fields above) | `name`, `description` |
| `EntityType` | `id`, `name` | `description`, `extends` |
| `RelationshipType` | `id`, `name` | `description`, `extends`, `sources[]`, `targets[]` (allowed entity types) |
| `RelationshipSet` | `id`, `relationships[]` (`id`, `type`, `source`, `target`; optional `description`, `technology`, `tags`, `properties`) | `name`, `description` |
| `Diagram` | `id`, `name`, `diagramType`, `nodes[]` | `description`, `layout` (settings), `edges[]` |
| `DiagramLayout` | `diagram` | `settings`, `nodes` (map of node ID → `{x, y, width?, height?}`), `edges` (map of edge ID → `{type?}`) |

- `diagramType` is one of `c4-context`, `c4-container`, `c4-component`, `network`, `deployment`, `custom`.
- Diagram `nodes[]` entries are view instances: `{entity, id?, label?}`; `id` defaults to `entity`. One entity may appear several times with distinct IDs (DIAG-09).
- Diagram `edges[]` entries are `{relationship, id?, source?, target?, label?}`; `id` defaults to `relationship`; `source`/`target` name view instances and are required only when the relationship's entity appears more than once.
- Layout settings: `direction` (`DOWN|UP|LEFT|RIGHT`), `nodeSpacing` and `layerSpacing` (0–1000), `edgeType` (`straight|bezier|step|smoothstep`), `gridSize` (integer 1–200), `snapToGrid`, `nodeWidth` and `nodeHeight` (10–2000). Coordinates are within ±1,000,000.

### Semantics

- **Entity types are user-defined.** There are no built-in types; a workspace declares its own (the example ships a standard C4/network/deployment set). `extends` gives single inheritance (SCHEMA-06).
- **Relationship type constraints** (`sources`/`targets`) accept the listed entity types and their subtypes. A relationship type inherits constraints from the nearest ancestor that sets them. Omitted constraints accept any entity.
- **ID categories** (SCHEMA-03): entities (from `Entity` and `EntitySet`), relationships, diagrams, entity types, relationship types and projects are each unique workspace-wide; the same ID may be reused across categories. `EntitySet` and `RelationshipSet` IDs share one collection namespace (SCHEMA-04). One `Workspace` resource per root; one `DiagramLayout` per diagram.
- **Duplicates** keep the definition with the smallest (file path, document index, item index) and report the others, so the outcome never depends on traversal order (SCHEMA-09).
- **Layout files** live next to their diagram as `<diagram-id>.layout.yaml`, or wherever an existing `DiagramLayout` for that diagram already is. The application writes a layout only when its file contains nothing but that `DiagramLayout` (LAYOUT-23). Layout files are written deterministically (sorted keys, two-decimal coordinates) with a header comment.
- **Orphaned overrides** (node/edge IDs not in the diagram, or layouts for unknown diagrams) are warnings, not errors, so they don't block a reload (LAYOUT-18).
- **Credential-like property keys** (`password`, `secret`, `token`, `apiKey`, `privateKey`, `credential`, `accessKey`, any case/separator) produce `SECRET_SUSPECTED` warnings (SEC-08).
- **Discovery** reads `*.yaml`/`*.yml` under the root, skipping hidden entries (`.git`, `.archidoc`, …) and `node_modules`.

## Consequences

- The schema is versioned and strict, so any later field change needs `archdocs/v2` or an additive change accepted by a new addendum. SCHEMA-10 (migrations preserving IDs) remains open: no migration exists yet because there is only one version.
- Flat resources are less extensible than a Kubernetes-style `metadata`/`spec` split, but they make the Entity/EntitySet equivalence trivial and keep files short. Reconsider before any `v2`.
- The layout-file placement rule means a `DiagramLayout` authored inside a multi-document file is read but can't be saved by the app until it's moved into its own file. The API reports this as `NOT_WRITABLE`.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Noted "(clarified by ADD-001)" on the KIND-*, SCHEMA-01..09 and MODEL-* items in `docs/checklists/01-model-and-schema.md`
- [x] No new requirement IDs
- [x] No items need unticking
- [x] Ran `scripts/prd-progress.sh --write`
