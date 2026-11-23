# 04: Relationships and derived edges

Status: done
Assignee: Claude (ticket-04-relationships session)
Blocked by: 03
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Authors declare dependencies under the consumer Element, and the core engine derives edges between higher-level Elements.

- `relationships:` on any Element, with `to`, `description`, `technology`, `interaction`, `via`, `channel`, `tags` and an optional `id`.
- `project:id` references across Projects. A Project may not qualify its own ids.
- Did-you-mean suggestions for unknown ids.
- A core query that derives edges at a requested level. Each derived edge carries the declared Relationships beneath it, and an edge that collapses onto a single node is dropped.
- Rules: `unknown-project`, `unknown-element`, `own-project-prefix`, `wrong-kind`, `duplicate-relationship-id`, `self-relationship`, `person-as-provider`, `ancestor-descendant-relationship`, `via-on-sync`, `via-not-broker`.
- The Bundle's `relationships` hold declared Relationships only.

## Acceptance criteria

- [x] Component-level Relationships derive the correct Service and System edges.
- [x] Several Relationships on one pair stay distinct in the Bundle.
- [x] A misspelt `project:id` reports the nearest id in its message.
- [x] Every new rule has failing and passing fixtures.
