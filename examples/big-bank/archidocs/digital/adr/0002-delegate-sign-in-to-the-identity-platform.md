---
status: accepted
date: 2025-07-21
decision-makers: [digital-banking, identity]
consulted: [platform]
elements: [security-component, identity:auth-service]
supersedes: ["0001"]
---

# Delegate sign-in to the Identity Platform

## Context and Problem Statement

The mobile app, the web app and the call center each needed customer sign-in,
and credentials in the API database could not be shared safely.

## Considered Options

- Keep credentials in the API database and expose a sign-in API
- Delegate sign-in to a central OpenID Connect provider

## Decision Outcome

Chosen option: delegate to `identity:auth-service`. The Security Component now
only validates tokens, and the API database keeps sessions, not credentials.
