# 03: Show that a Deployment is scaled

Status: ready-for-agent

## Problem

Nothing on a Deployment View shows that a Deployment runs as several instances. In the Sitecore Workspace the scaling lives only in the Target's name ("asp-sitecore-cd (Premium v3, Windows, autoscale 2…)").

## Decisions

- **Where it lives:** on the Deployment, as `instances: 3` (fixed) or `instances: { min: 2, max: 10 }` (autoscale). Not on the Deployment Target: one Target can host Deployments that scale differently. Absent means one instance.
- **How it draws:** a Deployment with `instances > 1` (or `max > 1`) draws as a stack, two offset copies of its box behind it (the LikeC4 look), plus a count chip beside the Team code: `×3` fixed, `2–10` autoscale. Same in the viewer and in exported SVG/PNG.
- **Key:** a "Stacked: scaled" row (the Key work is in ticket 07 / PR #118; rebase onto it if it has merged).
- **Modelling rule:** use `instances` for interchangeable copies on one Target (an App Service plan running N workers). Keep separate Deployments when placement is the point (one per AZ or VM), so the Sitecore Solr/ZooKeeper Deployments stay as they are.

## What to build

- Schema: `instances` on a Deployment in `src/core` and the generated `schemas/model.schema.json` (`scripts/generate-schemas.ts`), with a description an agent can act on. Validation: integer ≥ 1; `min ≥ 1`, `max ≥ min`.
- MCP: `upsert_deployment` accepts and returns `instances`; its description carries the modelling rule above.
- Bundle: the Deployment node carries `instances` so the viewer and renderer can draw it.
- Viewer and `src/render`: the stack and chip.
- Guide: `guide/topics/deployments.md` teaches the modelling rule with one example of each.
- Example: give one Deployment in `examples/kitchen-sink` an `instances` (fixed) and one in `examples/big-bank` an autoscale range.

## Tests

- Schema/load: valid fixed and range values load; `0`, `max < min` and a non-integer are errors with clear messages.
- MCP: `upsert_deployment` round-trips `instances`.
- Render: golden SVG for a Deployment View with a stacked node and both chip forms.
- e2e: a scaled Deployment shows the stack and chip.
