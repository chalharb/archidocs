# 09: YAML writer and Element/Relationship writes

Status: ready-for-agent
Blocked by: 04, 06
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

An agent edits the Model through MCP, and the author's YAML comments and formatting survive.

- A comment- and format-preserving YAML writer. Every edit is applied to an in-memory overlay, the whole Workspace is validated through the core engine, and the edit is written only if it introduces no error.
- Tools: `upsert_element(project, kind, id, fields, parent?, file?)`, `remove_element`, `upsert_relationship(project, from, to, fields, id?)`, `remove_relationship`, and `check`.
- Every write takes `dry_run` and returns a unified diff. A refused write returns `validation_failed` with the same issue records as `check`.
- Placement: a new Element goes into its parent's file; a new top-level Element goes into `file`, else `<project>/model.yaml`.
- Several Relationships on a pair with no `id` given returns `ambiguous` with each candidate's file:line.
- Removal is refused while anything references the item, with the list of references; nothing cascades.
- Writes never touch git.

## Acceptance criteria

- [ ] Fixture file text before and after each write shows comments and key order kept.
- [ ] A write that would introduce an error leaves the files unchanged and returns issues.
- [ ] `dry_run` returns the diff and writes nothing.
- [ ] The `ambiguous` and refused-removal cases return file:line references.
