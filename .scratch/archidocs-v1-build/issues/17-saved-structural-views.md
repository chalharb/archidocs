# 17: Saved structural Views

Status: ready-for-agent
Blocked by: 09, 13
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Authors and agents define named Views in YAML, and they resolve, export and validate.

- `views: structural:` in any Project: `title`, `description`, `tags`, `level: c1|c2|c3|deployment`, `include`/`exclude`, `expand`/`collapse`, `direction`, `lens`. Deployment Views also take `environment` and `targets`.
- Selectors:
  - a bare id;
  - `{element, with, upstream: n|all, downstream: n|all}`;
  - `{team}`;
  - `{tag}`;
  - `{from, to, paths: shortest|n}`.
- Resolution order:
  1. Include.
  2. Exclude.
  3. Collapse to `level`.
  4. Expand and collapse.
  5. Derive edges.
- The Lens is presentation only. `get_view` returns its definition, `mark: {hit, distance?}` per node and `lit` per edge.
- The Bundle's `views` slot holds the definitions with every id qualified. View ids are `project:view-id`.
- `upsert_view` and `remove_view` follow the write rules.
- Rules: `duplicate-view-id`, `target-outside-environment`, `bad-expand`, `empty-view` (warning), `unresolved-path` (warning), and `unknown-element` in selectors.
- `archidocs export` handles Saved Views with Lens highlighting, plus `--all-saved --out <dir>`.

## Acceptance criteria

- [ ] Resolver tests for every selector, `all`, the path selector and `expand`/`collapse`.
- [ ] A golden SVG of a Saved View with a Lens.
- [ ] Each new rule has failing and passing fixtures.
- [ ] `upsert_view` round-trips and keeps comments.
