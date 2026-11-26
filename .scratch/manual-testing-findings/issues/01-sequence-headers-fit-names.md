# 01: Sequence headers fit their names

Status: ready-for-agent

## Problem

A Dynamic View's participant headers truncate their names ("Content Au…", "Content Managem…", "Identity Server…") even when there is room.

## Cause

`src/render/sequence.ts:145` sizes each column as `textWidth(name) + headerPad`, clamped to `maxColumn: 200` (`:49`). Any name wider than ~136px is cut, and `.arc-seq-name` (`viewer/src/styles.css:2033`) ellipsises it.

## What to build

- Drop the `maxColumn` clamp (or raise it well past realistic names) so a header is as wide as its name plus the stripe and Team code. Column spacing already works from header widths, so neighbours move apart.
- Check `headerPad` covers the Team code chip; in the screenshot the name is cut even with the chip present.
- Same layout feeds `src/render/sequence-svg.ts`, so exported SVGs get it too.

## Tests

- Layout test: a participant named 40+ characters gets a column wide enough for `textWidth(name) + headerPad`.
- Regenerate `test/render/golden/sequence-full-checkout.svg` if it changes.
