# 01: View module behind one entry

Status: done
Blocked by: None (can start immediately)
Spec: [View module](../spec.md)

## What to build

Move View resolution into `src/core/views/` behind one entry, with no behaviour change. PR title: `refactor(core): ...`.

- Create the folder `src/core/views/`. Its index is the only file imported from outside the folder. Keep it browser-safe: no `node:` imports, directly or through what it imports.
- Move in, as private files: the Generated resolvers and `ModelIndex` from `views.ts`, `saved-views.ts`, `deployment-views.ts`, `dynamic-views.ts`, the View-marking half of `compare.ts` (`compareView`), and `save-as-view.ts`. `unionBundle` stays in `src/core/compare.ts`.
- Add one resolve that takes a Bundle and any View id and returns a Structural View or a Dynamic View, told apart by `kind`; undefined for an unknown id. It replaces the "try `resolveDynamicView`, then `resolveView`" ordering in callers.
- Add a check-facing resolve that returns a View with its problems, in today's shapes (`BadExpand`, `UnresolvedPath`, `DynamicProblem`), plus a way for `oversized-view` to get every Generated View resolved.
- Add the View id grammar to the interface: what kind of id this is, an Element's own View, an Environment's Deployment View, and the Generated Views holding a Step (today's `stepViews`). Decide here whether it is exposed as a parsed id value or as a handful of question functions; say which and why in the PR description. Every place in `src/` that slices or builds a View id uses it.
- Keep in the interface: list Views, the picked subset of a View, Save as View, Compare, the Dynamic Views using a Relationship, the Dynamic Views an Element takes part in, and a Lens in words (core's current wording, unchanged in this ticket).
- Stop exporting `build`, `ModelIndex`, `applyLens`, `resolveSaved` and `resolveDynamic`. Build `ModelIndex` once per resolve call.
- `ResolveOptions` keeps its current shape in this ticket, including the undefined/null Lens tri-state. Ticket 02 changes it.

Callers to re-point at the entry:

- `src/cli/main.ts:178`
- `src/mcp/server.ts:24-26`, `:190`, `:391`, `:441-459`
- `src/core/rules.ts:3-9`, `:180-202`, `:761-769`, and the other `resolvedSavedViews` / `resolvedDynamicViews` uses
- `src/render/svg.ts:2`
- `src/core/index.ts:10-11`, `:16`, `:18-19`
- `viewer/src/workspace.ts:1-3`, `viewer/src/App.tsx:3`, `viewer/src/SaveAsView.tsx`
- `e2e/saved-views.spec.ts:6`
- any import under `website/src`

The viewer's `Workspace` keeps its methods in this ticket; they call the new entry. Viewer string-slicing of View ids is left for ticket 03.

## Tests

- Re-point `test/core/views.test.ts`, `saved-views.test.ts`, `dynamic-views.test.ts`, `deployment-views.test.ts`, `compare.test.ts`, `picked-view.test.ts`, `save-as-view.test.ts` and `test/mcp/views.test.ts` at the module's entry. No test imports a private file. A test that reaches `build`, `ModelIndex` or `applyLens` goes through the interface instead, using a fixture Workspace and a View id.
- Add unit tests for the View id grammar: each id form, an unknown form, an Element's own View for a System, a Service with Components, a Service without, a Component and a Person.
- Add a test that the single resolve returns a Dynamic View for a Dynamic View id and a Structural View for each other form.

## Acceptance criteria

- [x] `src/core/views/` exists, and nothing outside it imports any file in it other than its index.
- [x] No import cycle remains among the View files or with `src/core/compare.ts`.
- [x] No caller tries a dynamic resolver before a structural one; `grep -rn "resolveDynamicView" src viewer website e2e` finds nothing outside the module.
- [x] No file in `src/` outside the module slices or builds a View id by hand.
- [x] `build`, `ModelIndex`, `applyLens`, `resolveSaved` and `resolveDynamic` are not exported from the module.
- [x] The golden SVGs in `test/render/golden/` are byte-identical to before.
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm test:e2e` pass.
- [x] This ticket's `Status:` is set to `done` in the same PR.
