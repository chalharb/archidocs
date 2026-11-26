# 06: Key starts folded

Status: ready-for-agent

## Problem

The canvas Key opens by default and covers the diagram.

## Cause

`readKeyOpen` (`viewer/src/Canvas.tsx:321`) opens it on any window ≥1200×760 when the visitor hasn't toggled it.

## What to build

- Default folded on every screen size; a visitor's own toggle is still remembered in `localStorage` (`archidocs.key`).
- Update the doc comment above `Key` and any e2e that expects it open.
