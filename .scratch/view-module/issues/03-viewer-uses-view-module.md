# 03: Viewer uses the View module

Status: ready-for-agent
Blocked by: 02
Spec: [View module](../spec.md)

## What to build

The viewer stops re-deriving what the View module knows. No behaviour change. PR title: `refactor(viewer): ...`.

### Delete the `Workspace` pass-throughs

Remove from `viewer/src/workspace.ts`: `resolve`, `picked`, `saveAsView`, `dynamic`, `stepViews`, `otherDynamicViews`, `ownLens`, `ownView` and `deploymentViews`. (`ownDirection` and `describeLens` went in ticket 02.) Screens call the View module on `workspace.bundle`:

- `viewer/src/App.tsx:105`, `:109`, `:120`, `:135`, `:200`, `:212`, `:221`, `:228`, `:240`, `:398`
- `viewer/src/SaveAsView.tsx:34`
- `viewer/src/ElementPanel.tsx:97`
- `viewer/src/DynamicScreen.tsx:199`, `:252`

`Workspace` keeps names, Teams, crumbs and the rail trees.

### Use the module's View id grammar

Replace every `startsWith("c2/")`, `startsWith("c3/")`, `startsWith("deployment/")`, `slice(3)`, `includes("/")`, `includes(":")` and hand-built `` `c2/${id}` `` on a View id with the module's grammar:

- `viewer/src/workspace.ts:140-143`, `:149-150`, `:156`, `:167-173`, `:232`, `:255`, `:271-277`
- `viewer/src/Rail.tsx:51`, `:224-227`
- `viewer/src/Canvas.tsx:43`

### Read Deployment facts from the node

`viewer/src/Canvas.tsx:42-43` reads the Deployment Target from the node and the Environment from the resolved View (both added in ticket 02), not from the node id and the View id. A Saved Deployment View then gets its Environment too, so a Deployment's URL is looked up in the right Environment.

### Leave alone

`Workspace.deployedIn` and `opening` in `App.tsx:395-403` keep resolving whole Views for now. They may switch to the module's entry but are not redesigned here.

## Tests

- The viewer has no unit tests; `vitest.config.ts` includes only `test/**`. This ticket adds none for React code. Anything it needs from the grammar is already tested through the module in ticket 01.
- The existing Playwright suite is the check that behaviour is unchanged: `e2e/navigation.spec.ts`, `saved-views.spec.ts`, `dynamic.spec.ts`, `canvas.spec.ts` and the rest.
- Add one e2e assertion that a Deployment in a Saved Deployment View shows the URL of that View's Environment.

## Acceptance criteria

- [ ] `Workspace` has none of the methods listed above.
- [ ] `grep -rnE "startsWith\(\"(c2|c3|deployment)/\"\)|slice\(3\)|lastIndexOf\(\"@\"\)" viewer/src` finds nothing.
- [ ] The viewer imports the View module only through its index.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm test:e2e` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
