---
status: accepted
date: 2025-03-14
decision-makers: [digital-banking]
elements: [security-component, database]
---

# Keep credentials in the API database

## Context and Problem Statement

The first release of internet banking needs sign-in, and the bank has no
customer identity service yet.

## Decision Outcome

The Security Component hashes and stores customer credentials in the API's
Oracle database.

### Consequences

- Good: no new system to run for launch.
- Bad: the mobile app and any future channel must go through the API to sign in.
