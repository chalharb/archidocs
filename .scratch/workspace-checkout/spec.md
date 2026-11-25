# Workspace checkout

Status: ready-for-agent

One module that opens a Workspace on disk once, and the CLI's commands as functions over it. This spec turns card 2 of the architecture review of 2026-11-24 into tickets, from the findings in [research.md](research.md) (checked against `origin/main` at `6b70992`). Terms follow [GLOSSARY.md](../../GLOSSARY.md); "module", "interface", "seam", "depth" and "leverage" are used as in the codebase-design vocabulary.

The open questions in the research were settled while writing this spec, without a grilling session. They are listed under "Decisions taken here" so they can be challenged before the tickets start.

## Problem Statement

Running a command means spawning a process, and opening a Workspace is written out by hand wherever one is needed.

- **The CLI can only be spawned.** `src/cli/main.ts:289` calls `main()` at the top level and doesn't export it. Ten command bodies are inline in one `if` chain (`:42`–`:241`), each writing to `process.stdout` itself. 77 test cases in `test/cli/` spawn `node src/cli/main.ts`, 69 of them through `test/support/cli.ts:8`. `vitest.config.ts:7-9` raises the timeout to 30 s because of it.
- **Other callers spawn it too.** The docs site exports every diagram (`website/src/lib/examples.ts:88-102`) and builds every screenshot site (`website/src/lib/screenshots.ts:80-91`) by spawning the CLI. So do `website/test/reference.test.ts:90`, `website/test/samples.test.ts:36`, `e2e/serve.ts` and `examples/big-bank/build-demo.mjs:64, :83`.
- **Opening a checkout is spread out.** Find the root, realpath it, find the git top level, read HEAD, load, make a history handle: the steps are written in `main.ts:254-287`, `cli/dev.ts:82-83`, `mcp/source.ts:51-54` and `mcp/history.ts:52-55`. One `build` finds the Workspace root up to four times. Realpath must come before `history()` (`history/index.ts:41` takes a relative path against git's resolved top level), and nothing enforces it.
- **"Which files count" is written three times**, and one copy has drifted: `core/load.ts:145-149`, `mcp/source.ts:152-155`, and `cli/dev.ts:160-161`, which reloads on any file, not only `.yaml` and `.md`.
- **Three rules find the git repo.** `src/git.ts` (`gitTopLevel`, `gitHead`, swallowing errors), `src/history/git.ts:9` (`git()`, which throws with git's stderr), and `core/load.ts:131-136`, which walks up the folders looking for `.git`.

## Solution

Three pieces, each with its own seam:

1. **A CLI adapter.** `run(argv, io)` parses the arguments, calls a command, writes to the streams it is given and returns an exit code. `main.ts` keeps only the shebang and one call to `run` with `process`'s streams. Tests and scripts call `run` in-process.
2. **A Checkout module** at `src/workspace/`. A Checkout is a Workspace root on disk. The module looks up the git facts once, in the right order, and owns the one "which files count" rule. `dev`, the MCP checkout source and MCP's history all take their facts from it.
3. **Commands as functions** in `src/commands/`: `check`, `build`, `exportViews`, `diff` and `buildHistory`, each over a Checkout and returning data. `run` formats that data and picks the exit code. The docs site calls these functions directly.

## Implementation Decisions

### One git runner

- `src/git.ts` becomes the only place that runs git. It holds `git(cwd, ...args)` (moved from `src/history/git.ts:9`, unchanged: `core.quotePath=false`, a 1 GiB buffer, git's stderr as the error message), plus `gitTopLevel` and `gitHead` rewritten on top of it. They keep their null-on-failure contracts.
- `src/history/git.ts` keeps the history queries (`gitFileSystem`, `commitInfo`, `defaultBranch`, `firstParentCommitsTouching`, `tagsByCommit`, `resolvePoint`, `isDate`) and imports the runner.
- The inline `git(...)` calls in `history/index.ts:218, :220, :268, :273` stay as they are; they already use the runner.

### Checkout module

The folder `src/workspace/`, node-only. Its index is the only file imported from outside the folder. Exact names are settled in [ticket 03](issues/03-checkout-module.md). The interface holds:

- **A Checkout at a known root**, constructed synchronously, for callers that already have the folder (`checkoutSource({ root })`, tests, the website). Its git facts are looked up lazily, once each.
- **Find a Checkout** from a starting folder, walking up as `findWorkspaceRoot` does today (`core/load.ts:122-129`, a folder then its `archidocs/`). It returns undefined when there is none. `findWorkspaceRoot` stays in core because the checks that test its search order use it with a fake `FileSystem`.
- **`root`**: the Workspace root as given or found, **not** realpath'd. This is what users see (MCP's `get_workspace_info`, error messages), so nothing visible changes.
- **The repo**: the realpath'd root, the git top level and the History handle, or undefined outside git. The realpath happens inside, before `history()`, so callers can't get the order wrong.
- **The Workspace name**: the repo's folder, else the root's (today's `main.ts:254-256`).
- **HEAD**: read on every call, because MCP and dev must notice a commit or a checkout.
- **Load**: the working tree's Bundle and issues. In git it calls `load` with the realpath'd root and git's top level, both resolved. `load` makes every path in the Bundle relative to `repoRoot` (`load.ts:47-48`), so passing git's resolved top level with an unresolved root would write `../../var/…` paths under a symlinked folder. Outside git it calls `load` as today.
- **The fingerprint**: path, mtime and size of every Workspace file (today's `mcp/source.ts:147-162`).
- **Is this a Workspace file**: the one rule. A path counts if no part of it starts with `.` or is `node_modules`, and it ends in `.yaml` (model) or `.md` (ADR). `load`'s walk and the fingerprint use it in ticket 03; dev's watcher moves onto it in ticket 06. The rule itself is a pure function in core (a new `core/workspace-files.ts`), so that `load` can use it without importing a node-only module. The Checkout module re-exports it.

`load` keeps its `.git` walk (`load.ts:131-136`) as the fallback for callers that don't pass `repoRoot`. Those are the history (which passes one already, `history/index.ts:66`) and direct test calls.

### Commands as functions

A folder `src/commands/`, node-only, with one index. Each function takes a Checkout and options and returns a tagged result. None of them writes to a stream or reads `process`.

- **check**: the issues.
- **build**: one of: the Workspace has errors (with the issues), wrote the Bundle, wrote the site, wrote the preview (base, base sha, head sha). Options: `out` (absolute), `viewerDir`, `keep`, `bundleOnly`, `preview: { base? }`. A preview finds both sides before writing anything, as today (`main.ts:88-93`). The empty Revision index outside git (`main.ts:277-280`) moves with it unchanged.
- **exportViews**: one of: the Workspace has errors, an unknown View id, or the files written. Options: the View ids or all Saved Views, format, direction, theme, label, `out`. PNG rendering (`render/node.ts`, resvg wasm) is loaded with a dynamic `import()` only in the PNG branch, so an SVG-only caller doesn't load wasm.
- **diff**: an unknown point, or the two sides and the Changes. A missing second point means the working tree, as today.
- **buildHistory**: the Revisions counted and built. It is undefined-safe: outside git it returns a "not in git" result instead of throwing.

`dev` (`serveDev`) already has this shape. It takes a Checkout instead of `root` and `workspace`. `mcp` stays an adapter concern: it is a long-running server over `process.stdin`/`stdout`.

### The CLI adapter

- `src/cli/run.ts` exports `run(argv, io)`. `io` carries `cwd`, `env`, `stdout` and `stderr`; `stdout.isTTY` is read from the stream given. It returns the exit code and never throws: any error becomes `archidocs: <message>` on stderr and exit 2, with the usage text for a `UsageError` or an `ERR_PARSE_ARGS` error, exactly as `main.ts:293-297` does today.
- Every path the CLI takes from argv (`--out`, `--workspace`, `--bundle`) is resolved against `io.cwd`, never `process.cwd()`.
- `useColor` reads `io.env` and `io.stdout.isTTY`.
- `run` formats the commands' results with the existing `cli/format.ts` and `cli/diff-format.ts`, and maps them to the existing exit codes (`EXIT` in `cli/commands.ts:12`). Every message string stays as it is: the docs site quotes some of them, and `website/test/help.test.ts` checks the prefix.
- `mcp` over stdio keeps using `process.stdin`/`process.stdout` directly. That command is the one exception to "`run` touches only `io`", and its tests keep spawning.
- `main.ts` is the shebang, one call to `run` with `process`'s streams, and `process.exitCode`.

### Behaviour changes

- **`archidocs dev` reloads only on Workspace files** (ticket 06). Today any file change outside hidden folders and `node_modules` reloads the page (`cli/dev.ts:161`). After ticket 06, only `.yaml` and `.md` files do. Nothing else feeds the Bundle, so the page shows the same thing; it just reloads less. This gets its own `fix(dev)` ticket so release-please writes a changelog line for it, and the site's Changelog page (generated from `CHANGELOG.md`) shows it.
- **The Bundle's `repoRoot` comes from git** (ticket 03) when the Workspace is in a repo, instead of from the `.git` walk. The two agree except under `GIT_DIR`, `GIT_WORK_TREE` or a folder named `.git` that isn't a repo. Golden Bundles in the tests should not change; if one does, the ticket says why.

There are no other user-visible changes: same output, same messages, same exit codes.

### Decisions taken here

These were the research's open questions. Each was settled for the smaller change; challenge any of them before ticket 03.

1. **Name and place**: `src/workspace/`, its type `Checkout`. Ticket 03 adds **Checkout** to `GLOSSARY.md`.
2. **`load` keeps its `.git` walk** as a fallback; a Checkout passes `repoRoot` explicitly.
3. **MCP's `Source` keeps its shape.** `checkoutSource({ root })` keeps its signature (15 callers in `src/`, `test/`, `e2e/` and `website/`). Internally it makes a Checkout at that root and uses its fingerprint, HEAD and load. `mcp/history.ts`'s `checkoutPast` uses the Checkout's repo instead of its own realpath and `gitTopLevel`.
4. **Commands return data**, but the adapter lands first (ticket 01) with the command bodies unchanged, so the spawn tests move in-process before any logic does.
5. **The binary keeps a smoke suite**: `test/cli/mcp.test.ts` (8 cases) plus three new spawn tests in `test/cli/binary.test.ts`: `version` exits 0, an unknown command exits 2 with usage, and a missing Workspace exits 2 with the `NO_WORKSPACE` message.
6. **`--out` resolves against `io.cwd`**, which equals `process.cwd()` for the binary.
7. **`root` is shown as given.** The realpath stays inside the Checkout.

## Testing Decisions

- `test/support/cli.ts` keeps `archidocs(cwd, env?, ...args)` and its `{ code, stdout, stderr }` result, but calls `run` in-process with string-collecting streams. The 69 cases that use it, and `e2e/serve.ts`, move in-process with no test body changed. Ticket 01 is done only when every one of them passes unchanged.
- In-process tests must be safe to run in parallel. No `process.chdir`, and no reading `process.cwd()` or `process.env` anywhere below `run`.
- The Checkout module is tested through its interface with fixture Workspaces from `test/support/workspace.ts`: a Workspace outside git, one inside git found from a subfolder, one under a symlinked temp folder (the realpath case), one in `archidocs/`, and HEAD moving between two calls.
- The "Workspace file" rule gets a table test: hidden folders, `node_modules`, `.yaml`, `.md`, other extensions, nested paths.
- The command functions get unit tests that assert on their results, not on text. The existing CLI tests stay as the formatting and exit-code tests; nothing that tests behaviour is deleted.
- `test/cli/dev.test.ts` and the MCP tests are re-pointed only where a signature changes.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` and `pnpm docs:test` pass at the end of every ticket. `pnpm docs:build` and `pnpm demo:big-bank` also pass after ticket 05.

## Build Tickets

| # | Ticket | Commit type | Blocked by |
|---|---|---|---|
| 01 | [CLI adapter: `run(argv, io)`](issues/01-cli-adapter.md) | `refactor(cli)` | None |
| 02 | [One git runner](issues/02-one-git-runner.md) | `refactor(git)` | None |
| 03 | [Checkout module](issues/03-checkout-module.md) | `refactor(workspace)` | 01, 02 |
| 04 | [Commands as functions](issues/04-commands-as-functions.md) | `refactor(cli)` | 03 |
| 05 | [Website and tests call commands in-process](issues/05-in-process-callers.md) | `refactor(website)` | 04 |
| 06 | [`dev` reloads only on Workspace files, and the docs say which files those are](issues/06-dev-reloads-on-workspace-files.md) | `fix(dev)` | 03 |

01 and 02 can run in parallel; both touch the import lines of `src/cli/main.ts`, so whichever merges second rebases. 04 and 06 can also run in parallel after 03. Ticket 06 holds the one user-visible change. Ticket 03 holds the `repoRoot` change, which users can't see in a normal repo; its PR description names it. The others change no behaviour.

## Documentation

The docs site is built from `website/`, the generated reference in `website/src/reference/`, `GLOSSARY.md` (published as the Glossary page and checked by the wording rules in `website/test/templates.test.ts`) and `CHANGELOG.md`. Each ticket that changes something documented updates the docs in the same PR:

| Ticket | What changes in the docs |
|---|---|
| 01 | The source comments that name `src/cli/main.ts` as where commands run: `website/src/reference/cli.ts:25` (`WORKSPACE_SEARCH`) and `website/test/help.test.ts:12` point at `src/cli/run.ts`. In `CONTRIBUTING.md`, a line under "Run the checks" on how CLI tests work: in-process through `test/support/cli.ts`, with spawning kept for `test/cli/binary.test.ts` and `test/cli/mcp.test.ts`. |
| 02 | None. |
| 03 | **Checkout** in `GLOSSARY.md`, which publishes it on the Glossary page. It must pass the wording rules (`pnpm docs:test`). The docs already say "Workspace checkout" to users (`website/src/reference/mcp.ts:250, :253`, `guides/agents/bootstrap-from-code.mdx:16`, `guides/viewer/compare-two-revisions.mdx:46`): link the first use on each of those pages to `/docs/reference/glossary/#term-checkout`, as the pages do for other terms. The `WORKSPACE_SEARCH` comment in `website/src/reference/cli.ts:24-27` names the Checkout module as the caller of `findWorkspaceRoot`. |
| 04 | None. Output, messages and exit codes are unchanged, so the generated CLI reference is byte-identical. |
| 05 | None. The built site's diagrams and screenshots must be byte-identical to `main`'s. |
| 06 | `dev`'s description in `src/cli/commands.ts:175`, which feeds the CLI's usage text, the `dev` reference page and the CLI index: it reloads when a `.yaml` or `.md` file in the Workspace changes. A new "Which files are read" section on the CLI reference index (`website/src/reference/cli.ts`, after "How the Workspace is found"): the rule, for `check`, `build`, `export`, `dev` and `mcp`. Today the rule is undocumented even for `check`. |

The pages that say the viewer "reloads as you edit" (`start/quick-start.mdx:79`, `start/tutorial.mdx:118`, `help/troubleshooting.mdx:38`, `README.md:167`, `CONTRIBUTING.md:27`) stay true after ticket 06 and don't change. Nothing else in `website/src/content/docs/`, `guide/` or `docs/` describes the CLI's internals, the git lookup or MCP's `source` shape. `checkoutSource({ root })` keeps its signature, so the MCP reference generator (`website/src/reference/mcp.ts:108`) and the landing page (`website/src/lib/landing.ts:84`) don't change.

## Out of Scope

- **Card 3, Revision index and site layout.** Everything that knows the `bundles/` paths stays where it is: `publishHistory` and `publishPreview` (`history/index.ts:184-262`), `bundlePast` (`mcp/history.ts:96-187`), the empty index served by dev (`cli/dev.ts:141`) and the viewer's reader (`viewer/src/revisions.ts`). Ticket 04 moves the empty-index writer from `main.ts:277-280` into `build` unchanged, so card 3 finds it in one place. If card 3 runs at the same time, `src/mcp/history.ts` is the shared file. This spec touches only `checkoutPast` (`:49-91`) there.
- **`archidocs init`.** It has no Workspace yet. It keeps using `gitTopLevel` on the realpath'd folder it was run in.
- **MCP over stdio in-process.** `serveStdio` stays bound to the process.
- **`website/scripts/walkthrough.ts`**, whose tutorial pages are shell scripts that need a real `archidocs` on `PATH`.
- **`package.json` scripts and `action.yml`**, which are how users run the binary.
- **Merging the CLI's flag definitions (`cli/commands.ts`) with the command functions.** The names are close but the concerns differ: one describes argv, the other does the work.

## Further Notes

- No ADR: nothing here is hard to reverse.
- The website already imports node-only `src/` code at build time (`website/src/lib/landing.ts:13` uses `checkoutSource`; `share-images.ts:6` uses `renderPngInNode`), so ticket 05 calling `src/commands/` from Astro is not a new kind of dependency.
- `exportAll` (`website/src/lib/examples.ts:92`) runs every example × theme in parallel. Separate processes isolated them; in-process they share module state (the ELK layout engine, and the history cache under `.archidocs/cache/` for Big Bank). Ticket 05 checks that this is safe, or runs them one after another.
- v8 coverage doesn't follow child processes, so `src/cli/main.ts` mostly shows as uncovered today. After ticket 01 the coverage numbers in the PR comment go up; that is expected.
