# 0009. Viewer

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

A Next.js static export must know every route when it is built, before any consumer's model exists.

## Decision

A Vite and React single-page app that reads data files at runtime.

The viewer is a Vite and React single-page app, built once at publish time. It fetches the data file the consumer's build writes, so the same viewer serves every model.

## Consequences

- Good: the viewer is built once and works for any model.
- Bad: routes are client-side, so deep links need a routing approach that works on plain file servers (see 0018).
