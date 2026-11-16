# 0019. Views live in CALM metadata

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

CALM 1.0 has no concept of a view, but the site is built around named diagrams that show a
chosen part of the model.

## Decision

An architecture file may declare views under `metadata.views`, as a list of objects with an `id`,
an optional `title` and an optional `group`. `metadata` may be an object or a list of objects, as
CALM allows both.

## Consequences

- Good: the file stays valid CALM and readable without Archidocs.
- Good: views sit next to the nodes they show, in the author's repository.
- Bad: other CALM tools ignore these views, and the shape may need to follow CALM if it adds views later.
