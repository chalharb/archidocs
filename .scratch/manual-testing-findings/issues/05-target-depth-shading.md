# 05: Shade nested Deployment Targets by depth

Status: done

## Problem

Deployment Targets nest deeply (subnet → availability zone → VM → System → Deployment), and every level draws with the same ground and frame, so it is hard to tell which box is inside which. Every header also repeats "DEPLOYMENT TARGET ·".

## Decisions

- **Depth shading:** each nesting level's ground is one step off its parent's, capped at 3–4 steps (deeper levels reuse the last step). Defined as tokens that hold in light and dark mode, per `DESIGN.md`. No per-kind frame styles.
- **Header:** drop the "DEPLOYMENT TARGET ·" prefix; show only the Target's kind, uppercased as today.
- **Kinds stay free text** (the author's word is printed as written; no viewer mapping of long names to short). Agents are steered to short kinds: `snet`, `vnet`, `az`, `vm`, `aks`, `ns`, `asp`, `region`.

## What to build

- Viewer (`viewer/src/Canvas.tsx`, `viewer/src/styles.css`) and `src/render` (exported SVG/PNG): depth-stepped grounds for Target groups; header shows the kind alone.
- Agent steering toward short kinds: the `kind` description in the schema source (and regenerated `schemas/model.schema.json`), the `upsert_target` MCP tool description, and `guide/topics/deployments.md`.
- Examples: switch Target kinds in `examples/` to short forms where they are long.
- Update `DESIGN.md` with the depth tokens.

## Tests

- Render: golden `test/render/golden/deployment-prod.svg` updated; a test that a Target at depth 1, 2, 3 and 5 gets steps 1, 2, 3, 3 (or the chosen cap).
- e2e: a Target header shows its kind with no "DEPLOYMENT TARGET" prefix.
