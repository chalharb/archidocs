# 0013. Command-line tool

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

The CLI must start fast and install without a build step.

## Decision

Node, a small command library, bundled before publishing.

The CLI is a Node program using the small `cac` command library, bundled with tsup before publishing. `dev` will run Vite's dev server plus a file watcher.

## Consequences

- Good: one bundled file to run.
- Bad: the bundle must keep working when installed from a tarball, which the pack test checks.
