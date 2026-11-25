# 02: One git runner

Status: needs-triage
Blocked by: None (can start immediately)
Spec: [Workspace checkout](../spec.md)

## What to build

One place runs git, with no behaviour change. PR title: `refactor(git): ...`.

- Move `git(cwd, ...args)` from `src/history/git.ts:9-17` into `src/git.ts`, unchanged (`-c core.quotePath=false`, 1 GiB `maxBuffer`, utf8, throws with git's stderr).
- Rewrite `gitHead` (`src/git.ts:5-13`) and `gitTopLevel` (`:16-23`) on top of `git()`. Keep their contracts: `gitHead` returns `{ commit: null, builtAt: null }` outside git or before the first commit; `gitTopLevel` returns null outside git. Nothing in `src/git.ts` calls `execFile` directly any more.
- `src/history/git.ts` imports `git` from `../git.ts` and keeps everything else: `gitFileSystem`, `commitInfo`, `defaultBranch`, `firstParentCommitsTouching`, `tagsByCommit`, `isDate`, `resolvePoint`, `joinRepo`.
- Re-point the imports of `git` in `src/history/index.ts:5` and anywhere else (`grep -rn "history/git" src test`).
- Leave `core/load.ts:131-136` (`findRepoRoot`) alone: it is filesystem-only and stays as `load`'s fallback (ticket 03 passes `repoRoot` instead).

If ticket 01 merges first, rebase: both tickets edit the import lines in `src/cli/main.ts` / `src/cli/run.ts`.

## Tests

- Add `test/git.test.ts` (or extend an existing git test): `gitHead` in a repo with no commits gives nulls; `gitTopLevel` outside git gives null; `git()` with a bad ref throws with git's own message.
- The existing history tests (`test/cli/history.test.ts`, `test/mcp/history.test.ts`, `test/history/`) pass unchanged.

## Acceptance criteria

- [ ] `grep -rn "execFile" src` finds only `src/git.ts`'s runner.
- [ ] `src/git.ts` exports `git`, `gitHead` and `gitTopLevel`; `src/history/git.ts` no longer defines a runner.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm test:e2e` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
