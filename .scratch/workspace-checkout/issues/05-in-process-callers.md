# 05: Website and tests call commands in-process

Status: ready-for-agent
Blocked by: 04
Spec: [Workspace checkout](../spec.md)

## What to build

The docs site and its tests stop spawning the CLI. No change to the published site. PR title: `refactor(website): ...`.

- `website/src/lib/examples.ts:87-108` (`exportAll`): call `exportViews` on a Checkout at `examples/<slug>/` instead of spawning `export --all-saved` and `export <view>`. Throw with the result if it isn't `written`. Keep the temp folder and file reading, or take the SVG text straight from the result if ticket 04 returns it (don't widen ticket 04's interface for this).
- Check that `exportAll`'s parallel runs (examples × themes, `:92`) are safe in one process: the ELK layout and anything cached at module level. If not, run them one after another and say so in the PR.
- `website/src/lib/screenshots.ts:85-91`: for the copied examples, call `build` on a Checkout at the copy instead of spawning `build --out`. The Big Bank branch (`:84`) keeps running `examples/big-bank/build-demo.mjs`.
- `website/test/reference.test.ts:83-95` (`cliIssueLines`): call `run(["check"], io)` from `src/cli/run.ts` with collecting streams, since the test is about the lines the CLI prints.
- `website/test/samples.test.ts:34-41` (`checkRules`): call `check` and map the issues to rule ids.
- Leave alone: `website/scripts/walkthrough.ts` (tutorials need a real binary on `PATH`), `examples/big-bank/build-demo.mjs` (it is what `pnpm demo:big-bank` runs), and `package.json` scripts.

## Tests

- `pnpm docs:test` passes.
- `pnpm docs:build` passes, and the exported SVGs in the built site are byte-identical to the ones `main` builds (diff `website/dist` against a build from `main`, or compare hashes of the diagram files, and say which in the PR).
- `pnpm demo:big-bank` and `pnpm test:e2e` pass.

## Acceptance criteria

- [ ] `grep -rn "src/cli/main.ts" website/src website/test` finds nothing.
- [ ] The built docs site's diagrams are byte-identical to `main`'s.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e`, `pnpm docs:test` and `pnpm docs:build` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
