# 11: CLI reference with examples and exit codes

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The CLI reference lists each command's flags and nothing else.

- **Examples:** add `examples` to each command in `src/cli/commands.ts`, each a command line and a line saying what it does. `website/src/reference/cli.ts` renders them under an "Examples" heading.
- **Exit codes:** add each command's exit codes to its definition and render a table. `check`'s are in its description today (1 on errors, 2 if it couldn't run).
- **How the Workspace is found:** a section on the CLI index: the current folder, its `archidocs/` folder, then each folder above. Today only an error message says so. Take the wording from the code that does the search.
- **See also:** each command page links the guide that uses it.

## Acceptance criteria

- [x] A unit test fails on a command with no example.
- [x] Every example parses with `parseCommandLine`.
- [x] Every command page has Examples and Exit codes sections.
- [ ] The CLI index explains how the Workspace is found, and the troubleshooting entry for "No workspace.yaml found" links it once 05 has landed.
- [x] The usage-text snapshot test still passes.

## Comments

### Build notes (2026-11-24)

- **Open criterion:** the CLI index explains how the Workspace is found, but the troubleshooting page (ticket 05) does not exist yet, so nothing links the section from there. Its entry for "No workspace.yaml found" should link `/docs/reference/cli/#how-the-workspace-is-found`; `website/src/reference/cli.ts` exports that as `WORKSPACE_SECTION`.
- **Definitions:** `CommandDefinition` gained `examples` and `exitCodes`, both non-empty tuples, so a command without either fails `tsc` as well as the unit test, and an optional `exitNote` for the two commands that serve until stopped. `EXIT` (0, 1, 2) and the `NO_WORKSPACE` message moved from `src/cli/main.ts` into `src/cli/commands.ts`, so the CLI and the reference read the same values. The usage text is unchanged, and the CLI has no per-command help to add examples to: `--help` is an unknown flag.
- **Exit codes, as `main.ts` sets them:** 0 on success; 1 only from `check` (any error, or any issue with `--strict`), `build` and `export` (the Workspace has errors, nothing written); 2 from the catch at the bottom of `main.ts` for anything thrown, with the usage summary after a `UsageError` or a `parseArgs` error. `diff` exits 0 whether or not anything changed. `dev` and `mcp --http` never exit on their own: there is no signal handler, so Ctrl+C ends the process and the shell reports 130. `dev` therefore lists only 2. `mcp` over stdio exits 0 when the client closes stdin.
- **`check`'s description** no longer carries its exit codes; the table does.
- **How the Workspace is found:** written from `findWorkspaceRoot` (`src/core/load.ts`): the start folder, its `archidocs/`, then the same pair in each folder above, to the root of the file system, not stopping at the git root. `--workspace <dir>` on `dev` and `mcp` only moves where that search starts, so `<dir>` can be the repo that holds `archidocs/`. `init` searches the same way but creates a Workspace instead of failing, and its `--workspace` (with `--skill`) is only printed. The per-command table is keyed by `CommandName`, so a new command must say where it looks. `test/cli/cli.test.ts` pins the search order with a recording file system.
- **Page order:** Usage, Examples, Arguments, Flags, Exit codes, See also. Each example is its own `sh` fence, so the build's command-line check reads it like any hand-written page's, and each flag is still a heading of its own.
- **See also:** the map lives in `website/src/reference/cli.ts`, not the CLI definitions, keyed by `CommandName`. A link to a hand-written page takes its text from that page's frontmatter title, so it follows the retitles in ticket 08; a missing page fails the generator, and `starlight-links-validator` fails the build. `history build` appears in no guide, so it links the Revisions and history concept; `version` links Other hosts, the one page that uses it. Nothing links `/docs/guides/model/dynamic-views/`, which is due to move.
- **Example ids** are Big Bank's: `c2/digital:internet-banking`, `payments:make-a-payment`, `deployment/prod`. A scoped Generated View takes a Qualified id (`c2/internet-banking` is an unknown View), which the reference did not show before.
- **Local test runs:** with five other builds on the machine, CLI tests that start a process hit vitest's 5 s default timeout at random; `pnpm test --testTimeout 30000` passed 723 of 723.
