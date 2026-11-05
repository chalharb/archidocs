# ADD-008: Optional minimap

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Addition |
| **Proposed** | 2026-11-05 by Claude, at Logan Harber's request |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.6 (with ADD-001..007) |
| **Affected IDs** | LAYOUT-26 (new), LAYOUT-10, PREC-01/02 |
| **PRD sections** | §2.3, §4 |

## Context

LAYOUT-10 puts a minimap on every diagram. On small diagrams it adds little, and in the bottom-right corner it can cover nodes (for example Card Network in the sample `containers` layout). The product owner wants it to be configurable.

## Change

### LAYOUT-26 (new)

> The minimap can be shown or hidden. It's shown by default and configurable per workspace, per diagram and in the layout file. The setting applies to both the view and edit routes and never appears in exports. — Priority: P1, Phase 1

### Settings

A new layout setting joins the existing precedence chain (PREC-01: app → workspace → diagram → layout file), like `animateEdges` (ADD-005):

| Setting | Type | App default |
|---|---|---|
| `showMinimap` | boolean | `true` |

It can be set in `Workspace.defaults.layout`, `Diagram.layout`, or a layout file's `settings`:

```yaml
kind: DiagramLayout
diagram: containers
settings:
  showMinimap: false
```

### Behaviour

- The editor's settings panel gets a **Show minimap** checkbox. Changing it is an undoable layout edit, saved to the layout file only (LAYOUT-22).
- The read-only view follows the effective setting, and doesn't offer a toggle.
- Zoom, pan and fit-to-view (LAYOUT-10) don't depend on the minimap.

## Consequences

- Purely additive: existing files stay valid and the default keeps today's behaviour, so there's no migration (SCHEMA-10) and no visual baseline changes.
- A small schema change (`LayoutSettings.showMinimap`), reusing the existing precedence, serialization and round-trip machinery.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Added LAYOUT-26 to `docs/checklists/03-layout.md` with "(added by ADD-008)"
- [x] Noted "(amended by ADD-008)" on LAYOUT-10 (still satisfied: the minimap is shown by default)
- [x] Recorded LAYOUT-26 in the allocated-IDs table
- [x] Ran `scripts/prd-progress.sh --write`
