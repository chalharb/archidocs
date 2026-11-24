# 19: Upgrading and versioning

Status: needs-info
Blocked by: None (waits for the maintainer's answers below)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

A `help/upgrading` page that says what a version number promises and how to upgrade. The Changelog is the only version page today.

The page can't be written until the maintainer states the policy. For each of these, is a breaking change allowed only in a major release?

1. CLI commands and flags.
2. The Model YAML that `check` accepts.
3. MCP tool names, inputs and outputs.
4. Rule ids. (Removed rules already keep a stub page.)
5. Viewer URLs.
6. The Bundle `schemaVersion`, and what a change to it means for published sites and caches.

And:

7. What does the Action's `@v1` tag follow?
8. Which Node.js versions are supported, and for how long?

Once answered, the page holds: the policy, how to upgrade the CLI and the Action together, what to re-run afterwards (`archidocs init`), and how to read the Changelog.

## Acceptance criteria

- [ ] The eight answers are recorded in this ticket.
- [ ] The page exists under Help and states each promise in one sentence.
- [ ] The Installation page's upgrade section links it.
