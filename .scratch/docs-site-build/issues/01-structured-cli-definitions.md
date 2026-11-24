# 01: Structured CLI definitions

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Replace the hand-written `usage` string in `src/cli/main.ts` with structured command definitions. Each command has a name, synopsis lines, a one-line description, and flags. Each flag has a name, an optional value placeholder, a default and a description. One source then drives the CLI's usage text and help, the docs site's CLI reference ([content sources](../../docs-site/issues/05-content-sources.md)), and the CLI-line check on docs pages ([hand-written correctness](../../docs-site/issues/08-hand-written-correctness.md)).

- Definitions live in one module the CLI and the site build can both import, with no CLI side effects on import.
- The parser for each command takes its options from the definitions, so a flag can't exist without a description.
- Export a `parseCommandLine(argv)` helper that reports an unknown command or flag without running anything. The docs build uses it.

## Acceptance criteria

- [ ] The usage text printed today is reproduced from the definitions (snapshot test), apart from wording improvements.
- [ ] Every flag of every command has a non-empty description (unit test).
- [ ] `parseCommandLine` accepts every documented synopsis and rejects an unknown command and an unknown flag.
- [ ] The existing CLI tests still pass.
