# Saved View export and selectors

Type: grilling
Status: open
Blocked by: –
Map: [Archidocs v1](../map.md)
Context: [Viewer UX](14-viewer-ux.md) lets people pick nodes or a path, export them as SVG/PNG, and turn the screen into a Saved View. Doing so showed gaps in [View kinds and definitions](10-view-definitions.md), whose Saved View query is `level` plus `include`/`exclude` selectors (`{element, with, upstream: n, downstream: n}`, `{team}`, `{tag}`).

## Question

What must a Saved View be able to express so that a sub-section people care about can be saved once and stay current, and how is any View rendered to an image outside the browser? Settle:
- **Mixed levels:** a Saved View collapses everything to one `level`, so it can't keep some Systems open and others collapsed, as the C2 Landscape can. Add a per-selector `collapsed`, let `level` vary per selector, or leave it out?
- **Unbounded impact:** is there an "all hops" value for `upstream`/`downstream` (the prototype wrote 99)?
- **Paths:** a selector for "everything between A and B" (shortest, or all within n hops), or do picked paths save as a fixed id list that won't follow Model changes?
- **Highlighting:** does a Saved View carry a lens (impact, Team, path) so its export is highlighted, or are Saved Views always plain?
- **Rendering:** an `archidocs export <view> --format svg|png` command for CI and docs. Its output (title, commit, key), how it reuses the viewer's layout and node sizes in Node without a browser, and whether `build` renders every Saved View into the Bundle's output.
