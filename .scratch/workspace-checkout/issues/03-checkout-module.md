# 03: Checkout module

Status: needs-triage
Blocked by: 01, 02
Spec: [Workspace checkout](../spec.md)

## What to build

Open a Workspace on disk in one place, with one "which files count" rule. This ticket holds the spec's two behaviour changes; list them in the PR description. PR title: `refactor(workspace): ...`.

### The rule

- Add `src/core/workspace-files.ts` with a pure `isWorkspaceFile(path)` (path relative to the Workspace root, `/` or `\` separated), and whatever small helpers `load`'s walk needs (for example "is this folder skipped"). A path counts if no part of it starts with `.` or is `node_modules`, and it ends in `.yaml` or `.md`. Browser-safe: no `node:` imports.
- `core/load.ts:145-149` (`walk`) uses it.

### The module

- Create `src/workspace/` with one index; nothing outside imports another file in it. Node-only.
- A Checkout at a known root, constructed synchronously. A way to find one from a folder, walking up like `findWorkspaceRoot` (`core/load.ts:122-129`) and returning undefined when there is none. Pick the names and write them in the PR description.
- The Checkout exposes:
  - `root`: as given or found, not realpath'd.
  - the repo: the realpath'd root, the git top level (`gitTopLevel` on the realpath'd root) and a `History` (`history(repoRoot, realRoot)`), or undefined outside git. Looked up once, lazily.
  - the Workspace name: the repo's folder, else the root's.
  - HEAD: `gitHead(root)` on every call.
  - load: in git, `load({ fs: nodeFileSystem(), root: realRoot, repoRoot, commit, builtAt })`; outside git, `load` with `root` as today. Both paths must be resolved: `load` makes Bundle paths relative to `repoRoot` (`load.ts:47-48`).
  - the fingerprint: moved from `mcp/source.ts:147-162`, using `isWorkspaceFile`.
- Re-export `isWorkspaceFile` from the module index.
- Add **Checkout** to `GLOSSARY.md` under Scope: a Workspace root on disk, possibly inside a git repo; what the CLI, dev and the MCP server read a Workspace from, as opposed to a Workspace Bundle. List the terms to avoid in its `_Avoid_` line.

### Callers

- `src/cli/run.ts`: replace `workspaceRoot`, `workspaceName`, `historyFromCwd`, `writeSiteHistory`'s git lookup and `loadFromCwd` with one Checkout opened per command. `build` opens it once, not four times. Keep the `NO_WORKSPACE` and "History needs the Workspace in a git repository." messages.
- `src/cli/dev.ts`: `serveDev` takes a Checkout instead of `root` and `workspace`. `rebuild` (`:81-83`) uses the Checkout's HEAD and load; the watcher (`:159-163`) calls `isWorkspaceFile` on the changed path. Update `DevOptions` and its doc comments.
- `src/mcp/source.ts`: `checkoutSource({ root })` keeps its signature and `root` field. Inside, it makes a Checkout at `root` and uses its fingerprint, HEAD and load. Delete the local `fingerprint`.
- `src/mcp/history.ts:49-56` (`checkoutPast`): use the Checkout's repo instead of `realpath` + `gitTopLevel` + `history`. Reach the Checkout through the source: add it to `CheckoutSource` as a read-only field. Leave `bundlePast` (`:96-187`) alone; it belongs to card 3.

### Behaviour changes (for the PR description)

- `archidocs dev` reloads only when a `.yaml` or `.md` file changes.
- In git, the Bundle's `repoRoot` comes from `git rev-parse --show-toplevel` instead of the `.git` walk.

## Tests

- New `test/workspace/checkout.test.ts`, through the module's index only, using `test/support/workspace.ts`:
  - outside git: no repo; the name is the root's folder; load works;
  - in git, found from a subfolder and from the repo root;
  - in `archidocs/`;
  - under a symlinked folder: the repo's root is realpath'd, `root` is not, and the Bundle's paths match those of the same Workspace opened through a real path;
  - HEAD read twice around a commit gives two shas;
  - no Workspace gives undefined.
- New table test for `isWorkspaceFile`: hidden folder, hidden file, `node_modules`, `.yaml`, `.md`, `.json`, nested path, Windows separators.
- `test/cli/dev.test.ts`: re-point at the new `serveDev` options. Add a case that writing a non-Workspace file (`notes.txt`) doesn't reload.
- `test/mcp/*` and `website/src/reference/mcp.ts` callers pass unchanged (the `checkoutSource({ root })` signature is kept).
- The golden Bundles and SVGs are byte-identical; if one changes, the PR explains why.

## Acceptance criteria

- [ ] `grep -rn "realpath\|gitTopLevel" src/cli/run.ts src/cli/dev.ts src/mcp` finds nothing outside the `init` path.
- [ ] `grep -rn 'startsWith(".")' src` finds only `core/workspace-files.ts`.
- [ ] `mcp/source.ts` has no `fingerprint` of its own.
- [ ] `build` finds the Workspace root once per run.
- [ ] `GLOSSARY.md` defines Checkout.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
