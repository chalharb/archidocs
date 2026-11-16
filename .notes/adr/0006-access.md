# 0006. Access

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Archidocs publishes files and has no server of its own to sign people in.

## Decision

Host access control in front of the static site.

Access control is the host's job. A single sign-on wrapper or built-in login may come later if that is not enough.

## Consequences

- Good: no authentication code to secure or maintain.
- Bad: sites that need login depend on the host offering it.
