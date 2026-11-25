# 01: CLI adapter: `run(argv, io)`

Status: needs-triage
Blocked by: None (can start immediately)
Spec: [Workspace checkout](../spec.md)

## What to build

Make the CLI callable in-process, with no behaviour change. The command bodies move as they are; only their reads of `process` change. PR title: `refactor(cli): ...`.

- Add `src/cli/run.ts`, exporting `run(argv: string[], io: Io): Promise<number>` and the `Io` type: `cwd`, `env`, `stdout` and `stderr`, where `stdout` may carry `isTTY`. Move `main` (`src/cli/main.ts:40-243`), `UsageError`, `useColor`, `workspaceName`, `workspaceRoot`, `historyFromCwd`, `writeSiteHistory` and `loadFromCwd` (`:245-287`) into it.
- `run` never throws. Move the top-level handler (`main.ts:293-297`) into it: any error writes `archidocs: <message>` to `io.stderr`, then the usage text for a `UsageError` or an `ERR_PARSE_ARGS` error, and returns `EXIT.couldNotRun`.
- Replace every `process.cwd()` below `run` with `io.cwd` (`main.ts:45, 99, 118, 154, 231, 266, 274, 284`). Resolve `--out`, `--workspace` and `--bundle` against `io.cwd` (`:94, :118, :176, :179, :185, :231`, and the `resolve(out)` in `write` at `:165`).
- Replace every `process.stdout.write` / `process.stderr.write` with `io.stdout.write` / `io.stderr.write`. `useColor` reads `io.env` and `io.stdout.isTTY`.
- `init` (`main.ts:45`) uses `realpath(io.cwd)`.
- `mcp` over stdio (`main.ts:239`) keeps calling `serveStdio` on the process. Leave a one-line comment saying this is the one command bound to the process.
- `main.ts` keeps the shebang and becomes: call `run(process.argv.slice(2), { cwd: process.cwd(), env: process.env, stdout: process.stdout, stderr: process.stderr })` and set `process.exitCode`. Keep the `VIEWER_DIR` and `PACKAGE_JSON` constants working from both `src/cli/` and `dist/cli/`: `run.ts` sits in the same folder, so the `../../` paths hold.
- Keep every message string byte-for-byte.

### Docs

- Point the comments that name `src/cli/main.ts` as where commands run at `src/cli/run.ts`: `website/src/reference/cli.ts:25` and `website/test/help.test.ts:12`.
- `CONTRIBUTING.md`, under "Run the checks": one or two sentences saying CLI tests call the CLI in-process through `archidocs()` in `test/support/cli.ts`, and that only `test/cli/binary.test.ts` and `test/cli/mcp.test.ts` spawn the built binary, so a new CLI test should use `archidocs()`.

## Tests

- `test/support/cli.ts`: `archidocs(cwd, env?, ...args)` keeps its signature and result. It calls `run` with collecting streams (`stdout.isTTY` unset), `cwd`, and `env` built as today: `process.env` without `NO_COLOR`/`FORCE_COLOR`, then the given env. Keep the old spawning version as `archidocsBinary` in the same file.
- Every test that uses `archidocs()` passes with no change to its body: `test/cli/cli.test.ts`, `export.test.ts`, `build-site.test.ts`, `history.test.ts`, `init.test.ts`, `build-preview.test.ts`, `guide.test.ts`, and `e2e/serve.ts`.
- Add `test/cli/binary.test.ts` with three spawn tests through `archidocsBinary`: `version` exits 0; an unknown command exits 2 with `Usage:` on stderr; `check` in a folder with no Workspace exits 2 with the `NO_WORKSPACE` message.
- Add a `run` unit test showing two calls with different `cwd`s in parallel each find their own Workspace.
- `test/cli/mcp.test.ts` is unchanged and keeps spawning.

## Acceptance criteria

- [ ] `src/cli/main.ts` holds the shebang and the call to `run`, and nothing else of substance.
- [ ] `grep -n "process\." src/cli/run.ts` finds only the stdio `mcp` branch.
- [ ] `test/support/cli.ts` doesn't spawn for `archidocs()`; every existing test using it passes unchanged.
- [ ] `test/cli/binary.test.ts` exists, with the three spawn tests.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` and `pnpm docs:test` pass.
- [ ] `node dist/cli/main.js version` works after `pnpm build`.
- [ ] `grep -rn "src/cli/main.ts" website/src/reference website/test` finds only `website/test/reference.test.ts` and `samples.test.ts`, which spawn the CLI until ticket 05.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
