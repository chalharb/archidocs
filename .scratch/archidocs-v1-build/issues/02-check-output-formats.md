# 02: Check output formats and exit codes

Status: ready-for-agent
Blocked by: 01
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

`archidocs check` becomes usable in CI and by other tools.

- Issue records: `{file, line, column?, rule, severity, message}`. `file` is relative to the repo root. Sorted by file, then line, then rule. An issue involving two places is reported once, at the later path, and its message names the other.
- `--format text` (the default): grouped by file, with a summary, and colour only on a terminal.
- `--format json`: `{issues, summary: {errors, warnings}}`.
- `--format github`: `::error`/`::warning` workflow commands.
- Exit code 0 means no errors; 1 means an error, or any warning with `--strict`; 2 means check couldn't run.
- Cascade suppression: an Element whose declaration fails the schema still registers its id.
- The rule catalogue (id, severity, meaning, failing example, fix) is generated from the rule definitions in the registry.

## Acceptance criteria

- [ ] CLI tests cover all three formats against the same fixture.
- [ ] Exit codes are 0/1/2, and `--strict` turns warnings into exit 1.
- [ ] A missing `workspace.yaml` and a bad flag both exit 2.
- [ ] A schema-invalid Element referenced elsewhere produces only the root-cause issue.
- [ ] The generated catalogue lists every registered rule with its example and fix.
