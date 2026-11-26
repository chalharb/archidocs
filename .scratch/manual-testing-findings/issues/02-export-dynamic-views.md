# 02: Export a Dynamic View from the viewer

Status: ready-for-agent

## Problem

Structural Views have Export (SVG/PNG) in the location bar; a Dynamic View has no export at all in the viewer.

## Notes

The CLI already exports Dynamic Views: `src/commands/export.ts:67-70` draws them with `renderSequenceSvg`. The viewer's `ExportMenu` (`viewer/src/LocationBar.tsx:134`) and `viewer/src/export.ts` only handle the structural canvas.

## What to build

- Show Export on a Dynamic View: SVG and PNG of the sequence chart, using `renderSequenceSvg` so it matches the CLI's output.
- "Picks" export does not apply to a sequence chart; hide those items there.
- Graph mode (`place.graph`): export the sequence chart either way, or the Step graph if cheap. Say which in the PR.

## Tests

- e2e (`e2e/dynamic.spec.ts`): Export → SVG on a Dynamic View downloads an SVG containing every participant and Step label.
