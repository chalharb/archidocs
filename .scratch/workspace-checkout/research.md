# Workspace checkout: research

Status: needs-triage

Research for card 2 of the architecture review of 2026-11-24: "A Workspace checkout module, with callable CLI commands". It checks the card's claims against `origin/main` at `6b70992` (after the View module, PR #69, merged), sketches an interface, and lists risks and open questions. No code was changed. Terms follow [GLOSSARY.md](../../GLOSSARY.md); "module", "interface", "seam", "depth" and "leverage" are used as in the codebase-design vocabulary. There is no `docs/adr/` yet, so nothing here contradicts an ADR.

**Verdict:** every claim still holds. Two counts differ slightly: 77 spawned test cases in `test/cli/` (card: 78), and a fourth copy of "find the git repo" in `load.ts` that the card did not name. The refactor is worth a spec.

## Claims checked

| # | Claim | Holds? | Today |
|---|---|---|---|
| 1 | `src/cli/main.ts` runs `main()` on import, so commands can only be called by spawning | Yes | `main.ts:289-299` calls `main(process.argv.slice(2))` at top level; `main` is not exported |
| 2 | 10 inline command bodies | Yes | `init` :42, `version` :51, `guide` :58, `check` :66, `build` :74, `dev` :113, `export` :139, `diff` :188, `history build` :208, `mcp` :218 |
| 3 | 78 tests spawn the CLI | Nearly: 77 | 65 test definitions in `test/cli/`, 77 cases once `it.each` expands; more in the website tests, e2e and the demo (below) |
| 4 | Opening a checkout is written separately in `main.ts`, `dev.ts`, `source.ts`, `history.ts` | Yes | See "Opening a checkout" |
| 5 | The "which files count" rule is written three times | Yes | `core/load.ts:145-149`, `mcp/source.ts:152-155`, `cli/dev.ts:160-161` |
| 6 | Two git wrappers | Yes | `src/git.ts` (23 lines) and `src/history/git.ts` (140 lines); plus a third repo-root rule in `core/load.ts:131-136` |
| 7 | The website, e2e and the demo shell out to the CLI | Yes | See "Who spawns the CLI" |
| 8 | `serveDev` is already the adapter shape | Yes | `cli/dev.ts:72` takes a root and callbacks; `test/cli/dev.test.ts:35` calls it in-process |

## Evidence

### 1–2. `main.ts` is the only way in

`main(argv)` (`main.ts:40-243`) is one `if (command === …)` chain. Each branch parses flags, opens the Workspace, does the work and writes to `process.stdout`/`process.stderr` itself. Only `serveDev`, `init` (`cli/init.ts`) and `authoringGuide` are already functions the branch calls; `check`, `build`, `export`, `diff` and `history build` have no callable form.

Process-global state the bodies read, which an in-process caller would have to supply:

- `process.cwd()`: `main.ts:45, 99, 118, 154, 231, 266, 274, 284`.
- `process.env` and `process.stdout.isTTY` through `useColor()` (`main.ts:246-251`).
- `process.stdout`/`stderr` writes in every branch; `process.exitCode` in the top-level handler (`:291, :297`).
- `VIEWER_DIR` and `PACKAGE_JSON` from `import.meta.url` (`:33, :36`).

### 3. Tests that spawn the CLI

Counted from the test files (`vitest list` collapses `it.each`, so each table was expanded by hand).

| File | Definitions | Cases run | How |
|---|---|---|---|
| `test/cli/cli.test.ts` | 15 of 17 | 27 | `archidocs()`; `it.each` of 4 at :116, of 10 commands at :169. The two "how the Workspace is found" tests call `findWorkspaceRoot` directly |
| `test/cli/export.test.ts` | 14 | 14 | `archidocs()` |
| `test/cli/build-site.test.ts` | 8 | 8 | `archidocs()` |
| `test/cli/history.test.ts` | 8 | 8 | `archidocs()` (`history build`, `diff`) |
| `test/cli/mcp.test.ts` | 8 | 8 | its own `spawn`/`StdioClientTransport`/`execFile` (:19-45) |
| `test/cli/init.test.ts` | 5 | 5 | `archidocs()` |
| `test/cli/build-preview.test.ts` | 5 | 5 | `archidocs()` |
| `test/cli/guide.test.ts` | 2 | 2 | `archidocs()` |
| **Total** | **65** | **77** | |

Almost all go through one helper, `test/support/cli.ts:8` (`archidocs(cwd, env?, ...args)` → `{ code, stdout, stderr }`, with `execFile` of `node src/cli/main.ts`). That is the seam to re-point. `vitest.config.ts:7-9` already raises the timeout to 30 s because "CLI tests spawn the CLI and git several times per test".

Outside `test/cli/`:

- `website/test/reference.test.ts:83-95`: `cliIssueLines` runs `check` once per rule in the registry (`:116`, one test, many spawns).
- `website/test/samples.test.ts:34-41`: `checkRules` runs `check --format json`, in an `it.each` over the deliberately failing samples (`:51`).
- `e2e/serve.ts:24, 40, 53`: builds every e2e site through the same `archidocs()` helper; `:61` runs the Big Bank demo script.

### 4. Opening a checkout

The order is: find the Workspace root, realpath it, find the git top level, read HEAD, load, then make a history handle. Realpath must come before `history(repoRoot, root)` because `history/index.ts:41` takes `relative(repoRoot, workspaceRoot)`, and `git rev-parse --show-toplevel` returns a resolved path (on macOS a temp folder is `/var/…` but git says `/private/var/…`).

| Step | Where it is written today |
|---|---|
| Find the root | `main.ts:258-262` (`workspaceRoot`, called 7 times: `:99, :118, :154, :231, :266, :274, :284`); `cli/init.ts:40` |
| Realpath | `main.ts:45` (init's cwd), `:269`, `:276`; `mcp/history.ts:53` |
| Git top level | `main.ts:46, :255, :267, :275`; `mcp/history.ts:54` |
| Git HEAD | `main.ts:285`; `cli/dev.ts:82`; `mcp/source.ts:51` |
| Load the working tree | `main.ts:286`; `cli/dev.ts:83`; `mcp/source.ts:54` |
| History handle | `main.ts:269, :276`; `mcp/history.ts:55` |
| Workspace name (repo folder) | `main.ts:254-256` |

One command opens the same checkout several times. `build` (site) calls `workspaceRoot` three times (`:82` through `loadFromCwd`, `:99`, `:274`) and `gitTopLevel` twice (`:100`, `:275`); with `--preview` it adds a fourth (`:91`). `export` opens it twice (`:154`, `:155`). `diff` against the working tree opens it twice.

Also not named by the card: `load` finds the repo root on its own, by walking up for `.git` (`core/load.ts:131-136`), so the Bundle's `repoRoot` and the history's `repoRoot` come from two different rules. They can disagree, for example under `GIT_DIR` or with a nested repo without `.git` at the top.

### 5. Which files count

- `core/load.ts:145-149`: skip names starting `.` and `node_modules`; `.yaml` is a model file, `.md` an ADR.
- `mcp/source.ts:152-155` (`fingerprint`): the same skip, and `.yaml` or `.md`. This is a copy of `walk` that stats instead of reading.
- `cli/dev.ts:160-161`: the same skip on any path part, but **any** other file triggers a reload, not only `.yaml`/`.md`. That is a small drift.

The edit rule in `writer/edit.ts:68` (writes only to `.yaml`) is a different rule and should stay where it is.

### 6. Git wrappers

- `src/git.ts`: `gitHead` and `gitTopLevel`. Both use `execFile` directly and swallow every error to `null`.
- `src/history/git.ts`: `git(cwd, …args)` (`:9`, with `core.quotePath=false`, a 1 GiB buffer and git's stderr as the error), `gitFileSystem`, `commitInfo`, `defaultBranch`, `firstParentCommitsTouching`, `tagsByCommit`, `isDate`, `resolvePoint`.
- `src/history/index.ts:218, :220, :268, :273` call `git(…)` for `rev-parse` and `symbolic-ref` inline, so a third set of ad-hoc git calls lives there.
- `core/load.ts:131-136` (`findRepoRoot`) is a filesystem-only stand-in for `gitTopLevel`.

`gitHead` could be `git(cwd, "log", "-1", …).catch(() => null)` on the shared runner. Nothing needs two.

### 7. Who spawns the CLI

| Caller | What it runs |
|---|---|
| `website/src/lib/examples.ts:88-102` | `export --all-saved` and `export <view>` per example × theme, in parallel, for every SVG on the docs site |
| `website/src/lib/screenshots.ts:80-91` | `build --out` per example (Big Bank through the demo script) |
| `website/scripts/walkthrough.ts:120, :147` | a shell shim named `archidocs` on `PATH`, for tutorial pages that are bash scripts. This one is meant to be a real binary |
| `website/test/reference.test.ts:90`, `samples.test.ts:36` | `check` |
| `examples/big-bank/build-demo.mjs:20, :64, :83` | `check` per stage, then `build` |
| `e2e/serve.ts` | through `test/support/cli.ts` |
| `package.json` `dev`, `demo:kitchen-sink` | `node src/cli/main.ts …`: user-facing, keep as is |
| `action.yml:87, :101` | the installed `archidocs` binary: user-facing, keep as is |

## Interface sketch

Names are placeholders for the spec.

### The checkout module

A node-only folder, for example `src/workspace/` (it uses `node:fs` and git, so not `src/core/`, which the viewer imports). Its index is the only entry.

```ts
/** A Workspace on disk, opened once: the root found, realpath'd, and the git repo around it. */
export interface Checkout {
  /** The Workspace root (the folder holding workspace.yaml), realpath'd. */
  readonly root: string;
  /** The git top level, or null outside git. */
  readonly repoRoot: string | null;
  /** How exports and site.json name the Workspace: the repo's folder, else the root's. */
  readonly name: string;
  /** HEAD now. Read on each call: MCP and dev must see HEAD move. */
  head(): Promise<{ commit: string | null; builtAt: string | null }>;
  /** The working tree's Bundle and issues. */
  load(): Promise<LoadResult>;
  /** What changed since the last call, by the one "which files count" rule. MCP's cache key; dev's watcher filter. */
  fingerprint(): Promise<string>;
  isWorkspaceFile(path: string): boolean;
  /** The Revisions and past Bundles, or undefined outside git. */
  history(): History | undefined;
}

export type OpenResult = { ok: true; checkout: Checkout } | { ok: false; reason: "no-workspace" };

/** Walks up from `start` as findWorkspaceRoot does; `workspace` pins the folder instead (`--workspace`). */
export function openCheckout(start: string): Promise<OpenResult>;
```

The steps then run in one place and in the right order. `load` is handed `repoRoot` instead of walking for `.git`. One git runner is shared by `head`, the top-level lookup and `src/history/`. `src/git.ts` goes.

### Commands as functions

Each command that needs a Workspace becomes a function over a `Checkout` that returns data, not text. The CLI adapter formats it and picks the exit code.

```ts
check(c): Promise<{ issues: Issue[] }>
build(c, { out, viewerDir, keep, bundleOnly, preview?: { base? } }):
  Promise<{ kind: "errors"; issues } | { kind: "bundle"; file } | { kind: "site"; out } | { kind: "preview"; base; baseSha; headSha }>
exportViews(c, { views: string[] | "all-saved", format, direction?, theme, label?, out }):
  Promise<{ kind: "errors"; issues } | { kind: "unknown-view"; id } | { kind: "written"; files: string[] }>
diff(c, { from, to? }): Promise<{ kind: "unknown-point"; point } | { kind: "ok"; from: DiffSide; to: DiffSide; changes }>
buildHistory(c, { since? }): Promise<{ revisions; built }>   // already a function in src/history; takes the Checkout
serveDev({ checkout, viewerDir, … })                         // as today, with root/workspace from the Checkout
checkoutSource(checkout)                                     // MCP: fingerprint + head + load from the Checkout
```

`init`, `version` and `guide` need no Workspace and stay small. `init` uses only the git-top-level half, so the module should expose that step on its own, or `init` keeps its two lines.

### The CLI adapter

```ts
// src/cli/run.ts
export interface Io { cwd: string; env: Record<string, string | undefined>; stdout: Writable & { isTTY?: boolean }; stderr: Writable }
export function run(argv: string[], io: Io): Promise<number>;   // parse argv, open, call, format, exit code

// src/cli/main.ts: the shebang and nothing else
run(process.argv.slice(2), { cwd: process.cwd(), env: process.env, stdout: process.stdout, stderr: process.stderr })
  .then((code) => { process.exitCode = code; });
```

`run` owns `UsageError`, usage text, `useColor(io)` and the `ERR_PARSE_ARGS` mapping (`main.ts:296`). The viewer and package paths stay module constants, but `build`/`dev` receive `viewerDir` so tests can point it elsewhere.

### How the tests re-point

- **`test/support/cli.ts`**: `archidocs()` keeps its signature but calls `run(args, io)` with string-capturing streams and `cwd`. That one change moves the 69 cases that use it, and `e2e/serve.ts`, in-process with no test body touched. Keep a spawning twin (`archidocsBinary()`) for a few smoke tests: shebang, exit code on a thrown error, usage on `ERR_PARSE_ARGS`.
- **`test/cli/mcp.test.ts`** (8): stdio and HTTP serving are long-running processes and are the real contract. Keep spawning; at most move the two exit-2 cases to `run`.
- **New unit tests** call `check`/`build`/`exportViews`/`diff` on a `Checkout` and assert on data, not on stdout. The CLI tests can then shrink to formatting and exit codes.
- **Website**: `examples.ts` calls `exportViews` and `screenshots.ts` calls `build`, both in-process. `reference.test.ts` and `samples.test.ts` call `check`, or `run` if they want the printed lines. `walkthrough.ts` keeps its shim, since tutorials run a real shell.
- **Demo** (`build-demo.mjs`): it could import the module (Node ≥ 22.18 strips types), but it doubles as "what a user would run". Recommend keeping it on the binary.

## Risks

- **Global state in-process.** `useColor` reads `process.env`/`isTTY`, and some tests pass env (`archidocs(cwd, { FORCE_COLOR: "1" }, …)`). `Io` must carry env, or colour tests change meaning. Any remaining `process.cwd()` read makes parallel in-process tests flaky, so `run` must use only `io.cwd`.
- **Unhandled throws vs. exit 2.** Today any throw becomes `archidocs: <message>` and exit 2 in the top-level handler. `run` must catch the same, including errors from `parseArgs`, or tests that assert exit 2 will see rejections instead.
- **Displayed root changes.** Realpath-ing once makes `Checkout.root` the resolved path. MCP's `get_workspace_info` (`server.ts:137, :148`) and write errors (`writes.ts:61`) print `source.root`, which today is the unresolved path for a checkout. Decide whether to keep the given path for display.
- **HEAD caching.** `checkoutSource` re-reads HEAD on every snapshot (`source.ts:51`) to notice a checkout or commit. `Checkout.head()` must stay a call; a cached field would break MCP's freshness.
- **The dev watcher narrows.** Moving dev onto `isWorkspaceFile` stops reloads for non-`.yaml`/`.md` files. That is probably right, but it is a behaviour change.
- **Website bundling.** `examples.ts` runs inside Astro's build. Importing `src/workspace` pulls `elkjs` and `node:child_process` into Vite SSR instead of a child process. Probably fine for build-time code, but untested; `renderPngInNode` (resvg wasm) should stay out of that import path.
- **Concurrency.** `exportAll` runs examples × themes in parallel. Separate processes isolate any module-level caches (ELK layout instance, history cache writes under `.archidocs/cache/`); in-process they are shared. Check that layout and history are safe to run concurrently.
- **Coverage.** v8 coverage in Vitest does not follow child processes, so most of `main.ts` likely shows as uncovered today. In-process tests will move the coverage numbers (up). Worth knowing before the PR coverage comment surprises anyone.

## Open questions

1. **Where does the module live, and what is it called?** "Checkout" is not in the glossary. Is it a Workspace on disk, as opposed to a Workspace Bundle? Should "Workspace root" become a term? Run `/domain-modeling` before the spec.
2. **Does `load` keep finding `repoRoot` itself** (`load.ts:131`) for callers without a Checkout (the viewer? tests?), or must it always be given one?
3. **Should MCP's `Source` become `Checkout | published Bundle`**, with `checkoutSource` deleted? Or does `checkoutSource` stay as a thin cache over a Checkout?
4. **Return data or formatted text?** The sketch returns data. A smaller first step is `run(argv, io)` alone, with the bodies unchanged, which alone removes the spawns. It could be its own ticket ahead of the Checkout.
5. **How many spawn tests to keep** as a binary smoke suite: the 8 in `mcp.test.ts` plus about 3?
6. **`build`'s `--out` is resolved against `process.cwd()`** (`main.ts:94`). Under `run`, it should be resolved against `io.cwd`. Confirm no test relies on the difference.

## Overlap with card 3 (Revision index and site layout)

Card 3's own text wasn't available to this session. What follows assumes it covers where the Revision index and past Bundles live in a site and who reads and writes them.

The site layout (`bundles/index.json`, `bundles/<sha>.json`) is known in six places today:

- written in `history/index.ts:185-196` (publish) and `:247-262` (preview);
- written empty in `cli/main.ts:277-280` (`writeSiteHistory`, outside git);
- served empty in `cli/dev.ts:141`;
- read in `mcp/history.ts:118, :153` (`bundlePast`) and in `viewer/src/revisions.ts:82, :103`.

The two cards touch the same files in different halves:

| File | Card 2 (checkout) | Card 3 (site layout) |
|---|---|---|
| `src/mcp/history.ts` | `checkoutPast` (`:49-91`): realpath + `gitTopLevel` + `history()` become `checkout.history()` | `bundlePast` (`:96-187`): reading the site's index and past Bundles |
| `src/history/git.ts` | merge `src/git.ts` into it as the one git runner | probably untouched, unless the index moves out of `history/index.ts` |
| `src/cli/main.ts` | `writeSiteHistory` (`:273-281`) opens the checkout again | the empty index it writes is site layout |
| `src/cli/dev.ts` | `rebuild` (`:81-83`) onto the Checkout | the empty index it serves (`:141`) |

**Suggested split:** card 2 takes everything that opens a checkout (including `checkoutPast` and the git-wrapper merge). Card 3 takes everything that knows the `bundles/` paths (`bundlePast`, `publishHistory`/`publishPreview`, the empty index in `main.ts:279` and `dev.ts:141`, the viewer's reader). Doing card 2 first is cheaper: it shrinks `main.ts` and `dev.ts`, so card 3 has one empty-index writer to replace instead of two. If they run in parallel, `mcp/history.ts` is the file they would conflict in, though in different functions.

## Suggested ticket shape (if a spec follows)

1. `run(argv, io)` adapter; `main.ts` becomes the shebang; `test/support/cli.ts` calls `run`; keep a few binary smoke tests. (No behaviour change.)
2. One git runner: fold `src/git.ts` into `src/history/git.ts`.
3. `Checkout` module: open once, with one "which files count" rule; `dev`, `checkoutSource` and `checkoutPast` take a Checkout; `load` is given `repoRoot`.
4. Commands as functions (`check`, `build`, `exportViews`, `diff`) returning data; the CLI formats.
5. Website and e2e call the functions in-process; drop the spawns there.
