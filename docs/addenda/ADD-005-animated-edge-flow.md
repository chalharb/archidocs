# ADD-005: Optional animated edge direction flow

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Addition |
| **Proposed** | 2026-11-05 by Claude, at Logan Harber's request |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.6 (with ADD-001) |
| **Affected IDs** | LAYOUT-25 (new), LAYOUT-15, PREC-01/02, BENCH-04, VR-01..09 |
| **PRD sections** | §2.3, §4, §7, §8 |

## Context

Relationships are directional (MODEL-04), but an arrowhead alone can be hard to follow in a busy diagram. The product owner asked for an option to animate edges so the direction of flow is visible: a dash pattern moving from source to target, as React Flow's animated edges and LikeC4's dynamic views do.

## Change

### LAYOUT-25 (new)

> Edges can optionally be animated to show direction of flow from source to target. Animation is off by default, configurable per diagram and per edge, disabled when the user's system requests reduced motion, and never present in exports. — Priority: P1, Phase 1

### Settings

A new layout setting joins the existing precedence chain (PREC-01: app → workspace → diagram → layout file):

| Setting | Type | App default |
|---|---|---|
| `animateEdges` | boolean | `false` |

It can be set in `Workspace.defaults.layout`, `Diagram.layout`, or a layout file's `settings`, like `edgeType`.

### Per-edge override

Layout files gain an optional `animated` flag on edge entries, next to the existing `type`:

```yaml
kind: DiagramLayout
diagram: containers
settings:
  animateEdges: false
edges:
  shop-api: { type: smoothstep, animated: true }   # just this edge
```

Effective value per edge: the edge's `animated` if set, otherwise the resolved `animateEdges` setting. The editor writes this to the layout file only; canonical files are never touched (LAYOUT-22).

### Behaviour

- Motion runs from the relationship's source to its target, so it reinforces the arrow, never contradicts it.
- **Reduced motion:** when `prefers-reduced-motion: reduce` is set, edges render static whatever the setting is. This is required for accessibility and is checked by an automated test.
- **Exports** (LAYOUT-15) are always static.
- **Visual regression** (VR-01..09) is captured with animation disabled, so screenshots are deterministic. One additional snapshot covers the static appearance of an "animated" edge with reduced motion.
- **Performance:** animation must not push node dragging below BENCH-04 (~60 FPS) on the medium benchmark diagram. If it does, animation pauses while dragging.

## Consequences

- Purely additive and optional: existing files stay valid, no migration (SCHEMA-10).
- Small schema change in two places (`LayoutSettings.animateEdges`, `EdgePresentation.animated`), plus precedence, serialization and round-trip tests, which reuse the Phase 0 layout machinery.
- Interacts with ADD-004 only visually: animation uses the edge's resolved line colour.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Added LAYOUT-25 to `docs/checklists/03-layout.md` with "(added by ADD-005)"
- [x] Recorded LAYOUT-25 in the allocated-IDs table
- [x] Ran `scripts/prd-progress.sh --write`
