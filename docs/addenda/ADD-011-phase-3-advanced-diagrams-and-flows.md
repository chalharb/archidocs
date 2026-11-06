# ADD-011: Phase 3 requirements — advanced diagrams and flows

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Addition |
| **Proposed** | 2026-11-06 by Claude (Product Analyst agent) |
| **Decided** | 2026-11-06 by the owner (PR #14) |
| **Baseline** | PRD v1.7 |
| **Affected IDs** | DIAG-06 (detailed), MODEL-11..12, DIAG-13..15, LAYOUT-27, TEST-09, E2E-09..11, VR-12..14, BENCH-08, PH3-EXIT (all new); PH3-01..05, SCOPE-01, DIAG-07, DIAG-11, LAYOUT-08, LAYOUT-14, LAYOUT-15 |
| **PRD sections** | §2.2, §2.3, §3, §4, §7, §8, §11 |

## Context

PRD §11 outlines Phase 3 in one line: "Custom diagrams, structured flow models, flowcharts, sequence diagrams, and advanced grouping." DIAG-06 ("Custom/general-purpose diagrams", P1) is also only a title. Checklist 09 requires each later phase to be broken into detailed requirements by an addendum before work starts. This addendum does that for Phase 3.

What exists today: every diagram is a list of entity view instances (`nodes[]`) and relationship edges (`edges[]`). `diagramType` already accepts `custom`, but it renders exactly like the other types. Grouping comes only from entity `parent` (LAYOUT-14, ADD-006). There is no way to describe an ordered interaction between entities, which both sequence diagrams and flow overlays need.

The design keeps the principles of Phases 0–2: YAML is canonical, every diagram element traces to a YAML definition, the canvas never creates or deletes model elements (SCOPE-01), presentation lives in `.layout.yaml`, and schema changes are additive (SCHEMA-10).

**Open questions** are listed at the end, each with the default this addendum assumes. Accepting the addendum accepts those defaults unless the decision says otherwise.

## Change

### Schema overview (all additive)

| Change | Where |
|---|---|
| New kind `Flow` | MODEL-11 |
| `diagramType` gains `sequence` and `flowchart` | DIAG-13, DIAG-14 |
| `Diagram` gains optional `flow`, `participants[]`, `steps[]`, `transitions[]`, `notes[]`, `groups[]` (each allowed only for the diagram types named below; elsewhere it is a schema error) | DIAG-06, DIAG-13, DIAG-14, LAYOUT-27 |

Existing files stay valid; no migration and no new `apiVersion` (SCHEMA-10). All new fields are strict (SCHEMA-08), use the existing ID rules (MODEL-08) and the existing collection limit (10,000 items).

Within one diagram, view-instance IDs, local step IDs, note IDs and group IDs share one namespace, because they are all keys in the diagram's `.layout.yaml` `nodes` map. Duplicates are errors.

### Structured flow models

**MODEL-11** (new): A `Flow` resource describes an ordered interaction between entities. — P1, Phase 3

```yaml
apiVersion: archdocs/v1
kind: Flow
id: checkout
name: Checkout
description: Customer pays for a basket
steps:
  - { id: submit, from: customer, to: web-shop, label: Submit order }
  - { id: charge, from: web-shop, to: payments-api, relationship: shop-payments, label: Charge card }
  - { id: charged, from: payments-api, to: web-shop, label: Payment result, reply: true }
  - { id: notify, from: web-shop, to: email-queue, label: Order confirmed, async: true }
```

| Field | Required | Notes |
|---|---|---|
| `id`, `name` | yes | Flow IDs are unique workspace-wide, as their own category (SCHEMA-03). |
| `steps[]` | yes | Ordered. Each step: `id` (required, unique within the flow), `from`, `to` (entity IDs), `label` (required); optional `relationship`, `description`, `async` (boolean), `reply` (boolean). |
| `description`, `tags`, `properties` | no | As on other kinds. |

**MODEL-12** (new): Flow validation. — P1, Phase 3
- Unknown `from`/`to` entities and unknown `relationship` IDs are errors, like broken relationship references today.
- A `relationship` that does not connect `from` and `to` (in either direction) is a warning (`FLOW_RELATIONSHIP_MISMATCH`).
- A step without `relationship` is allowed; it is a warning only if no relationship connects the two entities in either direction (`FLOW_UNMODELLED_STEP`), so flows nudge authors to keep the model complete without blocking a reload.
- Flows join the normalized model, graph index and snapshot; the entity inspector (DIAG-07) lists the flows an entity takes part in.

**DIAG-15** (new): Flow overlay. On a diagram's view route, the user can pick one of the flows whose steps touch the diagram's entities. The steps that map to a shown edge are highlighted and numbered in step order; other elements are dimmed; steps with no matching node or edge are listed beside the canvas as "not shown". The overlay is view state only: it is not saved and changes no file. — P2, Phase 3

### Sequence diagrams

**DIAG-13** (new): `diagramType: sequence` renders a `Flow` as a sequence diagram. — P1, Phase 3
- The diagram names its flow (`flow: checkout`, required for this type) and may give `participants[]`, an ordered list of entity IDs. Participants not listed follow in order of first appearance in the flow. Listing an entity the flow does not use is a warning. `nodes[]` and `edges[]` must be empty or omitted.
- Rendering: a header per participant (styled by DIAG-11: shape and colour), a lifeline, and one numbered message per step, top to bottom in step order. `async` steps use an open arrowhead; `reply` steps use a dashed line; a step with a `relationship` takes that relationship's line colour. A step whose `from` and `to` are equal is a self-message.
- Layout is computed deterministically from the flow, not by ELK, and is not editable: **Edit layout** is disabled with the reason "Sequence diagrams are laid out automatically" (DIAG-12). No `.layout.yaml` is read or written for them; one that exists is reported as an orphaned-override warning (LAYOUT-18).
- Inspection (DIAG-07) works on participants (the entity) and messages (the step, with its relationship if any). PNG and SVG export (LAYOUT-15) work as for other diagrams.

### Flowcharts

**DIAG-14** (new): `diagramType: flowchart` mixes entity nodes with diagram-local process steps. — P1, Phase 3

```yaml
kind: Diagram
id: refund-process
diagramType: flowchart
nodes: [{ entity: payments-api }]
steps:
  - { id: start, label: Refund requested, shape: start }
  - { id: check, label: Within 30 days?, shape: decision }
  - { id: reject, label: Reject, shape: end }
transitions:
  - { id: t1, source: start, target: check }
  - { id: t2, source: check, target: payments-api, label: "yes" }
  - { id: t3, source: check, target: reject, label: "no" }
```

- `steps[]`: `id`, `label` (required), `shape` (`start|end|process|decision|io`, default `process`), optional `description` and `color` (palette name, DIAG-11).
- `transitions[]`: `id`, `source`, `target` (each a step ID or a view-instance ID in the same diagram), optional `label` and `line` (`solid|dashed|dotted`). Unknown endpoints are errors.
- `edges[]` (relationship edges) still work between entity nodes.
- Steps and transitions are canonical: they live in the `Diagram` YAML, are never created or deleted on the canvas (SCOPE-01 still holds), and are not entities, so they appear in no other diagram and have no reverse references.
- ELK layout, the layout editor, layout persistence and export apply exactly as for other diagrams; steps are positioned through the same `.layout.yaml` `nodes` map.

### Custom diagrams

**DIAG-06** (detailed): `diagramType: custom` is a general-purpose diagram. — P1, Phase 3
- Any entity types and relationships may appear; no C4 conventions are applied.
- Optional `notes[]`: free-text annotations, `{id, text, color?}`, `text` up to 2,000 characters, rendered as plain text (no Markdown, no links). Notes are positioned and sized through `.layout.yaml` like nodes and are never connected by edges.
- Optional `groups[]` (LAYOUT-27).
- `steps[]`/`transitions[]` are not allowed (use `flowchart`).

### Advanced grouping

**LAYOUT-27** (new): Diagram-defined groups. — P1, Phase 3
- Allowed on `custom`, `flowchart`, `network` and `deployment` diagrams: `groups[]` of `{id, label, members[], color?, line?}`. `members` are view-instance, step, note or group IDs of the same diagram, so groups can nest.
- A member belongs to at most one group; a second membership is an error. Group cycles are errors. Unknown members are warnings.
- A node that is already inside a `parent`-derived boundary (LAYOUT-14, ADD-006) is not moved out of it: listing it in a group outside that boundary is a warning and the group membership is ignored. A group may contain a boundary node, which brings its contents with it.
- Groups render as labelled containers distinct from entity boundaries (dashed outline by default). ELK lays them out as compound nodes. Their positions and sizes are saved in `.layout.yaml` `nodes` with absolute coordinates, exactly as ADD-006 defines for boundaries; moving a group moves its members.
- Groups are presentation of the diagram, not of the model: they are not entities and have no reverse references.

### Testing and performance

**TEST-09** (new): Phase 3 test categories:
- `Flow` schema and validation (MODEL-11, MODEL-12), including mismatch and unmodelled-step warnings, and determinism regardless of file order.
- Sequence layout: participant order, numbering, self-messages, async and reply styling; deterministic output for the same input.
- Flowchart and custom-diagram schema: field-per-type rules, shared ID namespace, unknown endpoints.
- Group membership: nesting, double membership, cycles, conflicts with `parent` boundaries, absolute coordinates.
- Flow overlay mapping of steps to edges (DIAG-15).

New Playwright workflows:
- **E2E-09:** Open a sequence diagram, inspect a message and follow it to its relationship's diagram, and export SVG.
- **E2E-10:** Open a flowchart, move a step and a group in the editor, save, edit the diagram YAML externally, and see the saved positions survive the reload.
- **E2E-11:** Show a flow overlay on a container diagram and see the numbered steps and the "not shown" list.

New visual regression snapshots: **VR-12** sequence diagram, **VR-13** flowchart with all step shapes, **VR-14** custom diagram with nested groups and notes.

**BENCH-08** (new): Render a sequence diagram with 30 participants and 300 steps in under 1 s on the reference machine (PERF-05).

### Sample workspace

The sample workspace gains at least one flow, one sequence diagram over it, one flowchart and one custom diagram with nested groups and a note, so it doubles as the Phase 3 example (covered by DOD-style integration testing as for DOC-09).

### Phase 3 exit criterion

**PH3-EXIT** (new): A user can describe interactions and processes in YAML and see them as sequence diagrams, flowcharts, flow overlays and grouped custom diagrams, arrange the arrangeable ones visually, and trace every element back to its YAML definition, without the app modifying any canonical file.

The outline items in checklist 09 map to these requirements: PH3-01 → DIAG-06; PH3-02 → MODEL-11, MODEL-12, DIAG-15; PH3-03 → DIAG-14; PH3-04 → DIAG-13; PH3-05 → LAYOUT-27.

### Out of scope for Phase 3

- Creating, deleting or reconnecting flows, steps, transitions, groups or notes on the canvas (SCOPE-01 extends to them).
- Sequence-diagram fragments (`alt`, `loop`, `opt`), activation bars and manual message spacing.
- BPMN, swimlanes and other notations beyond the five flowchart shapes.
- Importing Mermaid, PlantUML or other external formats (§13, "External diagram imports").
- Model links to flows from Markdown (`flow:<id>`, DOC-04); a later addendum can add the scheme.
- Rule-based grouping (`groupBy`), see open question 4.

## Open questions

Each has the default this addendum assumes.

1. **Where flows live.** Default: a separate `Flow` kind, so one flow can back a sequence diagram and an overlay on any diagram. The alternative is to put steps directly on a sequence `Diagram`, which is simpler but not reusable.
2. **Unmodelled steps.** Default: a step may omit `relationship`, with a warning only when no relationship connects the two entities. Stricter alternative: every step must name a relationship (error otherwise), which keeps the model complete but makes quick sketches harder.
3. **Editable sequence layout.** Default: not editable; sequence diagrams are always laid out automatically. Allowing manual participant spacing would need new `.layout.yaml` fields.
4. **Grouping rules.** Default: explicit `groups[]` only. A `groupBy: project | tag:<name>` option could generate groups automatically, but interacts with explicit groups and boundaries and is left for later.
5. **Diagram-local elements.** Default: flowchart steps and notes are local to one diagram and are not entities. The alternative is to model process steps as entities with a user-defined type, which keeps one element kind but pollutes the entity model with process detail.
6. **Which diagram types allow groups.** Default: `custom`, `flowchart`, `network`, `deployment`. C4 diagrams are left out so C4 boundaries stay entity-backed; allowing groups there is a one-line change if wanted.
7. **Priorities.** Default: everything P1 except the flow overlay (DIAG-15, P2). Phase 3 can exit without DIAG-15 only if it is deferred by a later addendum.

## Consequences

- **Schema:** one new kind and optional, type-restricted `Diagram` fields; additive under SCHEMA-10. The JSON schema and `resource-schemas.ts` grow a discriminated rule set per `diagramType`.
- **Model and index:** flows join the normalized model, graph index and snapshot, so live reload (RELI-01..05), stale-model behaviour (DIAG-10) and diagnostics reuse the existing machinery.
- **Rendering:** a new deterministic sequence renderer beside the React Flow canvas; React Flow + ELK continue to handle flowcharts, custom diagrams and groups. Export must cover the sequence renderer.
- **Layout files:** `nodes` keys now include step, note and group IDs; the shared namespace avoids a new map. Existing layout files are unchanged.
- **Unchanged:** nothing in Phases 0–2 changes behaviour. Workspaces without the new fields load exactly as before.
- **Risks:** the sequence renderer is new code with its own visual tests; group/boundary interaction is the most likely source of layout bugs, so TEST-09 covers it explicitly.

## Decision

**Accepted** on 2026-11-06 by the owner (PR #14). Every open question takes its default:

1. Flows are a separate `Flow` kind.
2. A step may omit `relationship`. An unmodelled step is a warning, not an error.
3. Sequence diagrams are always laid out automatically and can't be edited.
4. Groups come from explicit `groups[]` only. There is no rule-based `groupBy`.
5. Flowchart steps and notes are local to one diagram. They are not entities.
6. Groups are allowed on `custom`, `flowchart`, `network` and `deployment` only, not on C4 diagrams.
7. Everything is P1 except the flow overlay (DIAG-15), which is P2.

The Product Analyst applies the checklist updates below in a follow-up PR.

## Checklist updates

To do on acceptance (Product Analyst, in a follow-up PR):

- [x] In `02-diagrams.md`, expand DIAG-06 and add DIAG-13..15 "(added by ADD-011)"
- [x] Add MODEL-11..12 to `01-model-and-schema.md`, LAYOUT-27 to `03-layout.md`, TEST-09, E2E-09..11 and VR-12..14 to `06-testing.md`, BENCH-08 to `07-performance.md`
- [x] In `09-later-phases.md`, add PH3-EXIT and point PH3-01..05 at the new items
- [x] Record the new IDs in the allocated-IDs table in `addenda/README.md` as allocated (they are reserved while this is Proposed)
- [x] Run `scripts/prd-progress.sh --write`
