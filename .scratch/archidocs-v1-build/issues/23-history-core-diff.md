# 23: History core and archidocs diff

Status: done
Assignee: Claude (session heuristic-lichterman)
Blocked by: 05, 17, 21
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Anyone with a checkout can compare the Model at two points in time.

- Points in time are refs or dates. A date resolves to the last first-parent default-branch commit at or before it.
- Revisions are first-parent default-branch commits that touched the Workspace root.
- Files are read at a commit with `git show`, without a worktree. Past Bundles and their index entries are cached in `.archidocs/cache/`.
- An older `schemaVersion` is rebuilt with the current Archidocs. There is a versioned migration framework for Bundle readers.
- Diff: a flat list of Changes (`added`, `removed` or `changed`, with before and after per field).
  - Covers everything in the Model: Elements, Relationships, Deployment Targets, Deployments, Teams, Environments, Projects, Saved Views and ADRs.
  - Matching follows the spec. Relationships match by id, else by a unique pair, else by (pair, technology, interaction).
  - Owner is compared as the effective Owner.
  - `source`, key order, `builtAt` and derived edges are ignored.
- CLI:
  - `archidocs diff <from> [<to>] --format text|json|markdown`;
  - `archidocs history build [--since]`, which is idempotent.

## Acceptance criteria

- [x] CLI tests against a temp git repo with scripted commits cover each item kind's Changes, an Owner change through the Project's default, and an unmatched Relationship becoming removed plus added.
- [x] A second `history build` builds nothing.
- [x] Commits touching only files outside the Workspace root are not Revisions.
