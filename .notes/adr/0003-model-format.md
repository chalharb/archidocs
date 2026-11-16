# 0003. Model format

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Teams need a model that stays readable without the tool and is not locked to one vendor.

## Decision

FINOS CALM.

The model format is FINOS CALM, an open standard. Archidocs reads CALM files as they are and never writes to them.

## Consequences

- Good: no format lock-in and plain JSON in the author's repository.
- Bad: CALM 1.0 has no views, so views are carried in `metadata.views` (see 0019).
