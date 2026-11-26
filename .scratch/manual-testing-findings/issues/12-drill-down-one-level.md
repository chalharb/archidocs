# 12: Drilling down from C1 goes one level

Status: ready-for-agent
Blocked by: 11

## Problem

On the C1 Landscape, the arrow tile on Sitecore XM Platform opens `#/view/c2/sitecore-xm:sitecore`, the System's own View, skipping the C2 Landscape.

## Decision

Drill-down goes one rung at a time: C1 → C2 Landscape → the System's View → C3.

- On the **C1 Landscape**, a System's arrow tile (and double-click) opens the **C2 Landscape** with that System selected and the camera on it.
- On the **C2 Landscape**, a System's arrow tile opens its own View, `c2/<system>`, as today.
- Elsewhere the arrow tile is unchanged. A Person or external Element on C1 has no arrow tile change.
- Update the Key's arrow-tile wording if it no longer reads right ("opens the box's own View").

## Tests

- e2e: from `#/view/c1`, the arrow tile on a System lands on `#/view/c2?sel=<system>` with the System in view; from there, its arrow tile lands on `#/view/c2/<system>`.
