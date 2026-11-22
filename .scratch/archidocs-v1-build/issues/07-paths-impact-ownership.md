# 07: Path, impact and ownership tools

Status: ready-for-agent
Blocked by: 04, 06
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

The Enterprise Architect, Product Owner and Developer questions can be answered through MCP.

- `find_paths(from, to, max_hops=4)`:
  - the direct declared and derived Relationships both ways, compared at the levels of the two Elements given;
  - the shortest paths up to `max_hops`, each hop with its Relationships;
  - a `via` broker counts as a hop.
- `get_impact(id, direction, max_depth?)`: the transitive set grouped by distance, with each Element's Owner and the Relationships that carry the impact. It includes descendants' Relationships and counts `via` as a dependency of both sides.
- `list_owned(team, kind?)`: the Elements and Deployment Targets a Team owns, grouped by kind, with counts of Upstream and Downstream Teams.
- `get_element` gains Relationships in and out and derived edges.
- All three are core queries first; the MCP tools are thin wrappers.

## Acceptance criteria

- [ ] Acceptance tests answer "how are two Services connected?", "what is upstream and downstream of an outage?" and "what does my Team own?" on the fixture.
- [ ] A path through an async `via` broker is found and counted as an extra hop.
- [ ] An Element owned by another Team than its parent is listed under its own Owner.
