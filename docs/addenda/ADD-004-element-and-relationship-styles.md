# ADD-004: Element and relationship styles (shapes, colours, line styles)

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Addition |
| **Proposed** | 2026-11-05 by Claude, at Logan Harber's request |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.6 (with ADD-001) |
| **Affected IDs** | DIAG-11 (new), DIAG-01..05, LAYOUT-22, VR-01..09 |
| **PRD sections** | §2.2, §3, §7 (visual regression) |

## Context

Phase 1 renders diagrams with React Flow. The product owner wants nodes and edges to look broadly like [LikeC4](https://likec4.dev)'s: solid colour-filled rounded nodes showing title, technology and description, distinct shapes for people, data stores, queues and front ends, and labelled relationship lines.

That needs per-element visual information the `archdocs/v1` schema (ADD-001) doesn't have. Because the schema is strict, adding it requires an addendum. This also has to be settled before Phase 1, since it determines the visual-regression baselines.

We will build our own React Flow components in this style. LikeC4's code and assets are not reused.

## Change

### DIAG-11 (new)

> Entity types, relationship types, entities and relationships can declare a visual style (node shape and colour; line style and colour). Diagrams render each element with its effective style, consistently across every diagram that shows it. — Priority: P0, Phase 1

### Schema additions (`archdocs/v1`, additive)

An optional `style` block is added to four places:

```yaml
kind: EntityType
id: database
name: Database
extends: container
style:
  shape: cylinder     # rectangle | person | cylinder | storage | queue | browser | mobile
  color: indigo       # palette name, see below
---
kind: RelationshipType
id: calls-async
name: Calls asynchronously
extends: calls
style:
  line: dashed        # solid | dashed | dotted
  color: amber
```

| Where | Fields |
|---|---|
| `EntityType.style` | `shape`, `color` |
| `Entity.style` (also each `EntitySet.entities[]` item) | `shape`, `color` — per-element override |
| `RelationshipType.style` | `line`, `color` |
| `RelationshipSet.relationships[].style` | `line`, `color` — per-relationship override |

- **Shapes:** `rectangle` (default), `person`, `cylinder`, `storage`, `queue`, `browser`, `mobile`.
- **Colours** (palette names, not hex values, so light and dark themes can each define them accessibly): `primary` (default for elements), `secondary`, `muted`, `slate`, `gray`, `blue`, `indigo`, `sky`, `green`, `amber`, `red`. Edges default to `gray`.
- **Lines:** `solid`, `dashed` (default, as in LikeC4), `dotted`.
- `style` objects are strict; unknown keys or values are schema errors, like everywhere else.

### Effective style resolution

Per key, later wins:

1. Built-in defaults (`rectangle` / `primary` for elements; `dashed` / `gray` for relationships)
2. Type ancestry, from the root type down to the element's own type (`extends` chain)
3. The entity's or relationship's own `style`

Resolved styles are added to the renderable data from diagram resolution (P0-07), so the client receives the final `shape`, `color` and `line` for each node and edge. They're computed per element, so every view instance of an entity (DIAG-09) looks the same.

### Out of scope

- **Icons.** LikeC4 supports technology and cloud icons, some from remote URLs. Remote fetching conflicts with local-first operation and SEC-09, and a bundled icon catalogue needs its own decision. Deferred to a later addendum.
- **Per-diagram visual overrides** (e.g. a node coloured differently in one diagram only). Not needed for the LikeC4 look; can be added later to `.layout.yaml` if wanted.

## Consequences

- **Presentation in canonical files.** PRD principle 2 separates architecture data from visual presentation. This proposal puts *element-level* styling in the type and entity definitions (the model's shared vocabulary), as LikeC4 does in its specification, because it should be consistent across all diagrams and is authored in YAML. *Diagram-specific* presentation (positions, edge routing types, layout settings) stays in `.layout.yaml`. The editor never writes `style` (LAYOUT-22 is unchanged): styles change only by editing YAML. If you'd rather keep canonical files free of any styling, the alternative is a separate `kind: Theme` resource mapping types to styles. That's more indirection for authors but cleaner separation.
- **Compatibility.** The change is additive and optional, so every existing `archdocs/v1` file stays valid and no migration is needed (SCHEMA-10). Files that use `style` won't load in builds from before this change, which is acceptable while there is a single application version.
- **Tests.** Schema tests for each new field and value, resolution tests for inheritance and overrides, and visual-regression baselines (VR-01..09) captured with the styled components.
- **Example workspace.** Update it to give people, databases, queues and front ends their shapes and distinct colours per system boundary, so it doubles as a style showcase.

## Decision

Accepted as written: element-level styles live on types and entities in the canonical YAML, not in a separate `Theme` resource. Diagram-specific presentation stays in `.layout.yaml`.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Added DIAG-11 to `docs/checklists/02-diagrams.md` with "(added by ADD-004)"
- [x] Noted "(styled per ADD-004)" on VR-01..09 in `docs/checklists/06-testing.md`
- [x] Recorded DIAG-11 in the allocated-IDs table
- [x] Ran `scripts/prd-progress.sh --write`
