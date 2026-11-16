# 0012. Layout engine

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Automatic layout of nested groups is heavy and the viewer should stay small.

## Decision

elkjs, at build time only.

Layout runs with elkjs in the CLI at build time and its output is written to the data file. It never enters the viewer bundle, and a test fails if it does.

## Consequences

- Good: a small viewer and deterministic layouts that can be tested.
- Bad: layout cannot adapt to the browser at view time.
