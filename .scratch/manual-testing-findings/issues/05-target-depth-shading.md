# 05: Shade nested Deployment Targets by depth

Status: needs-triage

## Problem

Deployment Targets nest deeply (subnet → availability zone → VM → System → Deployment), and every level draws with the same ground and frame, so it is hard to tell which box is inside which.

## Decide

- A ground step per depth (each level a little lighter/darker than its parent, capped at 3–4 steps), or a frame weight/colour per Target kind (subnet, AZ, VM).
- Must hold in light and dark mode and follow `DESIGN.md`; run it past the Impeccable design pass.
- Also consider dropping the repeated "DEPLOYMENT TARGET ·" prefix on every header to cut noise; the kind alone (`SUBNET`, `AVAILABILITY-ZONE`, `VM`) reads fine.
