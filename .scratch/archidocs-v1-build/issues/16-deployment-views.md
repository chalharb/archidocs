# 16: Deployment Views end to end

Status: done
Assignee: Claude (ticket 16 session)
Blocked by: 05, 13, 15
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Each Environment has a Deployment View in MCP, export and the viewer.

- `deployment/<env>` in the resolver: Targets nested as containers, with each System's Deployments in a System box inside each Target (drawing only).
- Edges: a consumer Deployment connects to the provider Deployments under their deepest shared Target, or to all of the provider's Deployments in the Environment when none is shared. A related Service with no Deployment in the Environment is a logical node outside every Target.
- Default direction is `TB`.
- Viewer: Deployment links next to the breadcrumbs, and "Where is it deployed?", which opens the View with the Service's Deployments marked.

## Acceptance criteria

- [x] Resolver tests cover the nearest-provider rule, the fallback when no Target is shared, and External providers.
- [x] A golden SVG for a Deployment View.
- [x] Playwright acceptance test for the Solutions Architect question.
