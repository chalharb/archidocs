# 11: CLI reference with examples and exit codes

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The CLI reference lists each command's flags and nothing else.

- **Examples:** add `examples` to each command in `src/cli/commands.ts`, each a command line and a line saying what it does. `website/src/reference/cli.ts` renders them under an "Examples" heading.
- **Exit codes:** add each command's exit codes to its definition and render a table. `check`'s are in its description today (1 on errors, 2 if it couldn't run).
- **How the Workspace is found:** a section on the CLI index: the current folder, its `archidocs/` folder, then each folder above. Today only an error message says so. Take the wording from the code that does the search.
- **See also:** each command page links the guide that uses it.

## Acceptance criteria

- [ ] A unit test fails on a command with no example.
- [ ] Every example parses with `parseCommandLine`.
- [ ] Every command page has Examples and Exit codes sections.
- [ ] The CLI index explains how the Workspace is found, and the troubleshooting entry for "No workspace.yaml found" links it once 05 has landed.
- [ ] The usage-text snapshot test still passes.
