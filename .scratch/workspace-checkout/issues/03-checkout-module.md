# 03: Checkout module

Status: needs-info
Blocked by: 01, 02
Spec: [Workspace checkout](../spec.md)

## What to build

Open a Workspace on disk in one place, with one "which files count" rule. The one behaviour change is where the Bundle's `repoRoot` comes from; name it in the PR description. PR title: `refactor(workspace): ...`.

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
- `src/cli/dev.ts`: `serveDev` takes a Checkout instead of `root` and `workspace`. `rebuild` (`:81-83`) uses the Checkout's HEAD and load. Leave the watcher's filter (`:159-163`) as it is; ticket 06 moves it onto the rule. Update `DevOptions` and its doc comments.
- `src/mcp/source.ts`: `checkoutSource({ root })` keeps its signature and `root` field. Inside, it makes a Checkout at `root` and uses its fingerprint, HEAD and load. Delete the local `fingerprint`.
- `src/mcp/history.ts:49-56` (`checkoutPast`): use the Checkout's repo instead of `realpath` + `gitTopLevel` + `history`. Reach the Checkout through the source: add it to `CheckoutSource` as a read-only field. Leave `bundlePast` (`:96-187`) alone; it belongs to card 3.

### Behaviour change (for the PR description)

- In git, the Bundle's `repoRoot` comes from `git rev-parse --show-toplevel` instead of the `.git` walk.

### Docs

- `GLOSSARY.md` publishes as the site's Glossary page, so the Checkout entry must pass the wording rules in `website/test/templates.test.ts`.
- Link the first "Workspace checkout" on each page that uses it to `/docs/reference/glossary/#term-checkout`: the MCP reference intro and write-tools text (`website/src/reference/mcp.ts:250, :253`), `website/src/content/docs/docs/guides/agents/bootstrap-from-code.mdx:16` and `guides/viewer/compare-two-revisions.mdx:46`.
- Update the `WORKSPACE_SEARCH` comment in `website/src/reference/cli.ts:24-27`: the Checkout module, not `run.ts`, now calls `findWorkspaceRoot`.

## Tests

- New `test/workspace/checkout.test.ts`, through the module's index only, using `test/support/workspace.ts`:
  - outside git: no repo; the name is the root's folder; load works;
  - in git, found from a subfolder and from the repo root;
  - in `archidocs/`;
  - under a symlinked folder: the repo's root is realpath'd, `root` is not, and the Bundle's paths match those of the same Workspace opened through a real path;
  - HEAD read twice around a commit gives two shas;
  - no Workspace gives undefined.
- New table test for `isWorkspaceFile`: hidden folder, hidden file, `node_modules`, `.yaml`, `.md`, `.json`, nested path, Windows separators.
- `test/cli/dev.test.ts`: re-point at the new `serveDev` options.
- `test/mcp/*` and `website/src/reference/mcp.ts` callers pass unchanged (the `checkoutSource({ root })` signature is kept).
- The golden Bundles and SVGs are byte-identical; if one changes, the PR explains why.

## Acceptance criteria

- [ ] `grep -rn "realpath\|gitTopLevel" src/cli/run.ts src/cli/dev.ts src/mcp` finds nothing outside the `init` path.
- [ ] `grep -rn 'startsWith(".")' src` finds only `core/workspace-files.ts` and `cli/dev.ts`'s watcher (ticket 06 removes that one).
- [ ] `mcp/source.ts` has no `fingerprint` of its own.
- [ ] `build` finds the Workspace root once per run.
- [ ] `GLOSSARY.md` defines Checkout, and the pages listed under Docs link it.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.

## Comments

**Triage, 2026-11-25:** `needs-info`. The spec's "Decisions taken here" were settled without a grilling session, and this is the ticket that sets them in code. Before an agent starts, the maintainer confirms or changes:

1. The name **Checkout** and its `GLOSSARY.md` entry, which is published on the site's Glossary page.
2. `root` shown as given, with the realpath kept inside the Checkout.
3. `checkoutSource({ root })` keeping its signature.
4. `load` keeping its `.git` walk as a fallback.

This doesn't hold anything up: the ticket is blocked by 01 and 02 anyway. Once confirmed, set `Status: ready-for-agent`.

Card 3 (Revision index and site layout) is being worked on in parallel. If it merges first, recheck the line references here into `src/mcp/history.ts`, `src/cli/dev.ts` and `writeSiteHistory`.
