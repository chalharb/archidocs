# 13: Hovering an edge highlights it and its ends

Status: ready-for-agent

## Problem

On a busy View (the Sitecore System's C2, with ~25 orthogonal edges sharing corridors) it is hard to follow one edge from end to end, or tell which two boxes it joins.

## Notes

Edges draw as a bare `<path>` in `Route` (`viewer/src/Canvas.tsx:531`); there is no hover state and the 1px path is hard to hit. Styles already exist for `arc-lit` and `arc-faded` (`viewer/src/styles.css:1144,1716`), used by Lenses and selection.

## What to build

- A wide invisible hit path under each edge (as `SequenceChart`'s `arc-step-hit` does) so it's easy to hover.
- On hover: the edge draws lit and on top of the others, its two end nodes highlight, and everything else fades, reusing `arc-lit` / `arc-faded`. Leaving restores the previous state, so a Lens or selection is not lost.
- A tooltip with the Relationship's description and technology (`<title>` is enough to start).
- Keyboard and touch: not required for hover; clicking an edge to select its Relationship is a possible follow-up, not this ticket.
- Respect reduced motion: no transition when it is on.

## Tests

- e2e (`e2e/canvas.spec.ts`): hovering an edge marks it lit and its `data-edge-from` / `data-edge-to` nodes highlighted, and other edges faded; moving away restores them.
