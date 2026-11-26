# 12: Drilling down from C1 goes one level

Status: needs-triage
Blocked by: 11

## Problem

On the C1 Landscape, the arrow tile on Sitecore XM Platform opens `#/view/c2/sitecore-xm:sitecore`, the System's own View, skipping the C2 Landscape. The breadcrumb then reads `C1 → C2 (Sitecore XM)` with no Landscape between.

## Notes

The arrow tile opens a box's own View by design (Key: "opens the box's own View"); for a System that's `c2/<system>`. Whether that is a skip depends on 11:

- If C2 Landscape opens every System, the arrow from C1 could open C2 Landscape with that System selected, and the arrow there opens `c2/<system>`.
- If the C2 Landscape is dropped, today's behaviour is already right and this closes.
