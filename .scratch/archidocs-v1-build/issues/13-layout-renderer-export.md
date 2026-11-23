# 13: Layout, renderer and export

Status: done
Assignee: Claude (ticket-13 session)
Blocked by: 12
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Any Generated structural View can be drawn as SVG or PNG from the CLI, with the same code the viewer will use.

- Layout: elkjs 0.12.1, `layered`, `ORTHOGONAL` routing, `hierarchyHandling: SEPARATE_CHILDREN`. Edges leaving a container are cut at border ports, one per (container, direction, destination branch). Children and edges are sorted by id. `BRANDES_KOEPF` node placement, fixed node sizes per kind, and direction `TB | BT | LR | RL`.
- Renderer: a pure SVG serializer producing a title, a source line (Workspace, short commit, date), a key (sync/async, Team stripe and code, External) and labels cut to length, with one embedded font. PNG via resvg (wasm).
- `archidocs export <view-id> --format svg|png [--out] [--direction]`.
- The renderer is shared and usable from both Node and the browser.

## Acceptance criteria

- [x] Golden SVG tests for C1, C2 and C3 fixtures are byte-identical across runs and on two OS runners.
- [x] Layout checks pass: no overlaps, no edges through nodes, only right-angled segments.
- [x] Adding one Service to a fixture moves no node inside an untouched System.
- [x] PNG output decodes and has the expected dimensions.
