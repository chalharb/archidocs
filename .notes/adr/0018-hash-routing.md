# 0018. Hash-based deep links

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Deep links must work from a plain file server and under any sub-path, with no rewrite rules.

## Decision

Hash history for the viewer's URLs.

The viewer uses hash history, so every link is the page's own URL plus a fragment. Assets and the data file use relative URLs, so the same build works at any base path.

## Consequences

- Good: no host configuration and links survive reload.
- Bad: URLs contain `#`, and server-rendered previews of a deep link are not possible.
