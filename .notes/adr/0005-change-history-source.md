# 0005. Change history source

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

The site must show what changed, when and by whom, without a second system to maintain.

## Decision

Commit history.

Change entries come from commit history and nowhere else. The build fails loudly when history is incomplete, such as in a shallow clone.

## Consequences

- Good: no extra files for authors to keep in sync.
- Bad: CI must check out full history, and squash merges coarsen the entries.
