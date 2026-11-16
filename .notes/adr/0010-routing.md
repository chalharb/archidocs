# 0010. Routing

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Shareable links need typed URL search parameters for view and selection state.

## Decision

TanStack Router.

The viewer uses TanStack Router.

## Consequences

- Good: typed search parameters suit linkable state.
- Bad: the library is young and moves quickly, so versions are pinned by the lockfile.
