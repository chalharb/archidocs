# 14: Viewer skeleton and site build

Status: done
Assignee: Claude (ticket-14-viewer)
Blocked by: 13
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

`archidocs build --out <dir>` writes a static site where people browse the Generated Views.

- A React viewer built into the npm package and copied as is. It reads `workspace.bundle.json` by relative URL.
- Hash routing. The URL holds the View, open boxes, selection and direction. Changing the View or open boxes pushes a history entry; selection replaces the current one. Includes the Recent list (last 10) and Copy link.
- The rail: Model and Views trees (collapsible, By kind / By Team) that open as a flyout.
- Breadcrumbs up the scope ladder, and chips for open boxes.
- The canvas: React Flow 12.12.x, layout in a web worker using 13's layout options.
  - Expand and collapse with `+`/`−`.
  - Double-click opens a box's own Generated View.
  - Selecting a node fades the edges that don't touch it.
  - A direction toggle.
  - Animated transitions up to 100 nodes, and never with `prefers-reduced-motion`.
  - Team stripes in a generated OKLCH palette.
  - Below 45% zoom, sub-labels and Team codes hide.
- Playwright set up against a site built from the fixture.

## Acceptance criteria

- [x] Playwright: opening a copied link restores the same View, open boxes and selection; back and forward work.
- [x] Rendered geometry meets the layout rules.
- [x] The site works when served under a sub-path.
