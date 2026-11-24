# 02: Export restyle, themes and label

Status: done
Blocked by: None (can start immediately)
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Bring `archidocs export` in line with the viewer's Wayfinding Plate look ([dark-theme diagrams](../../docs-site/issues/12-dark-theme-diagrams.md)), and add what the docs site needs ([build and deploy](../../docs-site/issues/07-build-and-deploy.md)).

- **One token source:** move the palette into one module that `src/render/svg.ts`, `src/render/sequence-svg.ts` and the viewer's CSS all use. The viewer's CSS custom properties are generated from it or checked against it, so the two can't drift.
- **Restyle:** `svg.ts` and `sequence-svg.ts` use the Wayfinding Plate tokens: Station Slate ink, Upstream Rust and Downstream Blue for lenses, 1.5px ink frames, and the node shapes from `DESIGN.md`.
- **No fades:** drop the `DIM` opacity fade. Stepped-back nodes and edges use the solid faint styling the viewer uses.
- **`--theme light|dark`**, default `light`. Dark uses the viewer's Night shift tokens. Applies to SVG and PNG.
- **`--label <text>`** replaces the header's source line (today the checkout folder · commit · date).

## Acceptance criteria

- [x] Light export colours equal the viewer's light tokens; dark export colours equal its dark tokens (unit tests against the shared module).
- [x] No element in an exported SVG has an opacity below 1 (test over every Saved View in `examples/`).
- [x] `--theme dark` and `--label "Big Bank · v1.2.0"` work for `export <view-id>` and `--all-saved`, for SVG and PNG.
- [x] Default output stays light, and the Action's `images: true` still works (the existing `action` CI job passes).
- [x] The viewer looks unchanged (the e2e tests pass).
