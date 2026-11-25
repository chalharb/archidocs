# 04: Commands as functions

Status: ready-for-agent
Blocked by: 03
Spec: [Workspace checkout](../spec.md)

## What to build

Move the work of `check`, `build`, `export`, `diff` and `history build` out of `run` into functions over a Checkout that return data. `run` keeps argv checks, formatting and exit codes. No behaviour change. PR title: `refactor(cli): ...`.

- Create `src/commands/` with one index; nothing outside imports another file in it. Node-only. Each function takes a Checkout and an options object and returns a tagged result. None writes to a stream, reads `process`, or throws for an expected outcome. Unexpected errors (a git failure, a full disk) still throw, and `run` reports them as today.
- **check**: the issues.
- **build**: `errors` (issues) | `bundle` (file) | `site` (out) | `preview` (base, base sha, head sha). Options: absolute `out`, `viewerDir`, `keep`, `bundleOnly`, `preview?: { base? }`. Keep the order: with `preview`, both sides are found before anything is written (`run`'s copy of `main.ts:88-93`). The viewer-not-built check moves here as a result (`viewer-missing`), not a throw. The empty Revision index outside git (`main.ts:277-280`) moves here unchanged.
- **exportViews**: `errors` | `unknown-view` (id) | `written` (files). Options: `views: string[] | "all-saved"`, `format`, `direction?`, `theme`, `label?`, absolute `out`. It names files and lays out and draws Views as `main.ts:162-185` does. Load `render/node.ts` with `await import()` only when `format` is `png`.
- **diff**: `unknown-point` (point) | `ok` (from side, to side, Changes). A missing `to` is the working tree.
- **buildHistory**: `not-in-git` | `ok` (revisions, built). Options: `since?`.
- `run` (`src/cli/run.ts`) keeps every flag check and `UsageError` exactly as it is, opens the Checkout, calls the function, and turns each result into today's output and exit code with `cli/format.ts` and `cli/diff-format.ts`. Every message string stays byte-for-byte, including "Not writing the site: the Workspace has errors." and the unknown-View hint (`main.ts:184`).
- `dev`, `mcp`, `init`, `version` and `guide` stay in `run` as they are.

## Tests

- New `test/commands/*.test.ts`, through `src/commands/` only, asserting on results:
  - check: issues for a broken Workspace;
  - build: each result kind, including `errors` writing nothing and a preview with a missing base writing nothing;
  - exportViews: an unknown id, a single View, `all-saved`, and a PNG (checks the PNG header);
  - diff: an unknown point, two refs, a ref against the working tree;
  - buildHistory: outside git, and a second run that builds nothing.
- The CLI tests in `test/cli/` pass unchanged. They are now the formatting and exit-code tests.
- Golden SVGs are byte-identical.

## Acceptance criteria

- [ ] `src/cli/run.ts` contains no `load(`, `layoutView`, `renderSvg`, `publishHistory` or `resolveView` call.
- [ ] `grep -rn "process\.\|stdout\|stderr" src/commands` finds nothing.
- [ ] Importing `src/commands/index.ts` and exporting an SVG doesn't load `@resvg/resvg-wasm` (assert in a test, or show it in the PR).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.

## Comments

**Triage, 2026-11-25:** `ready-for-agent`, once 03 is done. If card 3 (Revision index and site layout) merges first, the empty-index writer this ticket moves out of `writeSiteHistory` may already be gone; take it from wherever card 3 left it.
