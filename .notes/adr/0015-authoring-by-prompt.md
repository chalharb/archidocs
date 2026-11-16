# 0015. Authoring by prompt

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Hand-writing model JSON is the biggest barrier to starting and to keeping a model current.

## Decision

An author can describe a diagram to an assistant instead of editing source.

Release 3 adds an agent skill and write tools. The output is still plain CALM in the repository, checked by `validate`.

## Consequences

- Good: lowers the cost of keeping a model current.
- Bad: write tools need care so they never bypass validation.
