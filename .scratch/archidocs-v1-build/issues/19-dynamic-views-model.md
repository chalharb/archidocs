# 19: Dynamic Views: model and MCP

Status: ready-for-agent
Blocked by: 17
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Authors write scenarios as Dynamic Views, checked against real Relationships, and agents can read them.

- `views: dynamic:` with `title`, `participants?` and Steps `{from, to, relationship?, description?, note?, return?}`.
- Step resolution:
  - A non-return Step collects forward Relationships without `via` and reverse `via` subscriptions. Exactly one match is the Step; more than one is `ambiguous-step` unless `relationship` names one.
  - Steps may connect higher-level Elements over derived edges.
  - A return Step needs a sync Relationship the other way.
- Labels: an event Step defaults to its Relationship's `channel`; calls and returns default to the Relationship's description.
- Participants are ordered by first appearance unless `participants` fixes the order.
- `get_view` returns `participants` and `steps: [{n, kind: call|return|event, from, to, relationship, interaction, via?, channel?, description, note?}]`.
- `list_views(element)` and `get_element.dynamicViews` include Dynamic Views with an event Step `via` a broker.
- Rules: `missing-step`, `ambiguous-step`, `return-without-relationship`, `return-on-async`, `ancestor-descendant-participants`.

## Acceptance criteria

- [ ] Resolver tests for call, return and event Steps, derived-level Steps, and both kinds of ambiguity.
- [ ] Each rule has failing and passing fixtures.
- [ ] A broker appears in `list_views` for a Dynamic View that only routes events through it.
