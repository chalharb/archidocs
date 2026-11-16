# 0008. Distribution

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

Consumers should install once, configure once and run a command, without a bundler or a web framework.

## Decision

One npm package holding the command-line tool and a prebuilt viewer.

One package named `archidocs` ships the bundled CLI and the prebuilt viewer. It is split only when someone needs to embed a part.

## Consequences

- Good: one install and one version.
- Bad: the viewer's build tooling lives in the same repository and must never leak into the published files.
