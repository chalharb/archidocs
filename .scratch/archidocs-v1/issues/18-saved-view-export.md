# Saved View export and selectors

Type: grilling
Status: resolved
Assignee: Logan Harber
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

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (Lens). This amends the Saved View parts of [View kinds and definitions](10-view-definitions.md) and adds two rules to [archidocs check](16-archidocs-check.md).

**Mixed levels**
- A Saved View may list `expand: [ids]` and `collapse: [ids]` at its top level, beside `level`. They mirror the viewer's open boxes, so Save as View maps open boxes onto them one-to-one.
- **Resolution** becomes:
  1. Union the `include` selectors.
  2. Subtract the `exclude` selectors.
  3. Collapse every Element to `level`.
  4. Open each `expand` Element one level deeper, and close each `collapse` Element.
  5. Derive edges.
- An `expand` or `collapse` id that isn't in the View, or has no children, is an error (`bad-expand`).
- Per-selector `level` was rejected, because it is unclear when selectors overlap.

**All hops**
- `upstream` and `downstream` accept `all`: the full transitive closure, counting a `via` broker as a hop, as numbers do.
- Runaway Views are caught by the existing `oversized-view` warning.
- Save as View writes `all` for an impact lens (the prototype wrote 99).

**Path selector**
- `{from: a, to: b, paths: shortest | <n>}`, with `paths` defaulting to `shortest`. `<n>` means every path of at most n hops, mirroring the viewer's *Shortest* / *All ≤ 4 hops*.
- Direction and `via` rules are those of `find_paths` ([MCP tool surface](08-mcp-tool-surface.md)), so the viewer, MCP and Saved Views agree.
- It is a selector like any other, so it can be used in `include` or `exclude` and follows Model changes.
- A path selector that finds no path is a warning (`unresolved-path`), not an error: a Model edit can legitimately break it.
- *Connect to…* in the viewer saves as this selector, not as a list of picked ids.

**Lens**
- A Saved View may carry one optional `lens:`, one of:
  - `{impact: <id>, direction: upstream | downstream | both}`
  - `{team: <id>}`
  - `{path: {from, to, paths}}`
- A lens is presentation only and never changes which nodes the View contains.
- The viewer applies it on open, and you can clear it. Exports, from the viewer or the CLI, keep its highlighting.
- Save as View writes the active lens into `lens:`, as well as turning it into an include selector.
- **MCP:** `get_view` returns the `lens` definition plus its marks:
  - per node, `mark: {hit, distance?}`;
  - per edge, `lit`.

**`archidocs export`**
- `archidocs export <view-id> --format svg|png [--out path] [--at <commit>] [--direction TB|BT|LR|RL]`, plus `--all-saved --out <dir>` to render every Saved View in one pass.
- It works for any View id: Generated, Saved, and Dynamic Views drawn as a sequence chart.
- **Picture:** the View's title; the source (Workspace, short commit and date); a key for sync/async line styles, the Team stripe and code, and External; and the lens highlighting, if any.
- **Direction:** `--direction` overrides the View's `direction`. With neither, the default is `LR`, as in the viewer.
- **One renderer:** a shared render package holds the layout options, the fixed node sizes and the SVG serializer. The viewer's Export button calls the same code, so the CLI and the viewer give the same picture.
  - The layout is elkjs, and node sizes are fixed with labels cut to length, so no DOM measuring is needed and it runs in Node (as the prototype's `src/export.ts` showed).
- **PNG:** rasterised from that SVG with resvg (wasm), with no headless browser. One font is bundled and embedded, so output doesn't depend on the fonts installed on the CI machine.
- **Stable output:** the same View at the same commit gives byte-identical SVG, so committed docs images show up in diffs only when something really changed.
- **Not in v1:**
  - a `--only ids` subset (save a View instead);
  - dark theme (light only);
  - a `--lens` override.

**`build`**
- `build` stays bundle-only and renders no images. CI renders Saved Views with `export --all-saved`.
- Whether the published viewer site includes rendered images is for [Viewer build and publishing](19-viewer-build-publishing.md).

**MCP**
- No `export_view` tool in v1. Image content isn't supported by every MCP client, and [MCP tool surface](08-mcp-tool-surface.md) keeps to text and structured results. Agents that need a picture run `archidocs export`, and `get_view` gives the structure. This could be added later.

Prototype that exposed these gaps: branch `prototype/14-viewer-ux`, `src/export.ts` (SVG serializer and screen-to-YAML mapping).
