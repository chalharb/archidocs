# 01: Walking skeleton: check and Bundle

Status: done
Assignee: Claude (session nervous-sinoussi-18c52b)
Blocked by: None (can start immediately)
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

The thinnest end-to-end path: a fixture Workspace on disk goes in, and `archidocs check` reports problems or `archidocs build --bundle-only` writes a Workspace Bundle.

- Scaffold the TypeScript project: a test runner, lint, and CI running the tests.
- zod schema for `workspace.yaml` (Teams, Environments), `project.yaml` (id, name, owner) and top-level Services only. Other Element kinds come in 03.
- The core engine's Load interface: a Workspace root on a file-system abstraction goes in, `{bundle, issues}` comes out. Workspace root found by walking up from the current folder.
- Project discovery, merging a Project's files, and resolving Team and Environment references.
- A validator rule registry with the first rules: `yaml-syntax`, `unknown-field`, `missing-field`, `invalid-value`, `nested-project`, `file-outside-project`, `duplicate-project-id`, `definition-outside-workspace`, `unknown-team`, `duplicate-id`.
- `archidocs check` with text output. `archidocs build --bundle-only` refuses to write on any error.
- The Bundle contract: header, definitions, `projects`, `elements` with `source: {file, line}`, keys in a fixed order.

Tests go through the core engine seam with fixture Workspaces in temp folders, plus one CLI smoke test.

## Acceptance criteria

- [x] A valid fixture Workspace (two Projects, Teams, Environments, Services) builds a Bundle with qualified ids and source locations.
- [x] Building the same Workspace twice gives byte-identical Bundles.
- [x] Each listed rule has a failing fixture and a passing fixture.
- [x] A YAML syntax error in one file is reported as an issue, and the other files are still checked.
- [x] `build --bundle-only` writes nothing when there is an error.
- [x] CI runs the test suite on every push.
