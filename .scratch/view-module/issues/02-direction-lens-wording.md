# 02: Direction, Lens option and Lens wording

Status: ready-for-agent
Blocked by: 01
Spec: [View module](../spec.md)

## What to build

The user-visible changes to the View module, in one PR. PR title: `fix(views): ...`.

### Direction is always set

- A resolved Structural View always carries its direction: the Saved View's own, else `TB` for a Deployment View, else `LR`. `direction` becomes required on the type.
- Remove the `LR` default in `src/render/layout.ts:79`; layout takes the direction from the View unless the caller overrides it (`archidocs export --direction`, the viewer's direction control).
- Remove `defaultDirection` from `viewer/src/place.ts:42` and `Workspace.ownDirection` from `viewer/src/workspace.ts:94`. `viewer/src/App.tsx:110-111` and `:218` read the resolved View's direction.
- First reproduce the bug this fixes, as a failing test: a Saved Deployment View (`level: deployment`) with no `direction` resolves to `TB`. Today the CLI exports it `TB` and the viewer lays it out `LR`; that divergence was found by reading the code and has not been reproduced by running it. If it does not reproduce, say so in the PR and keep the rest of the change.

### The Lens option is explicit

- Replace `lens?: BundleLens | null` (undefined keeps a Saved View's own Lens, null clears it) with an explicit three-way choice: the View's own Lens (the default), no Lens, or a given Lens.
- CLI and MCP keep today's behaviour through the default.
- The viewer passes its choice explicitly at `viewer/src/workspace.ts:78` (today a `null` default), and wherever `App.tsx` resolves with a Lens (`:120`, `:135`).

### One Lens wording

- The module's "a Lens in words" uses Element, Team and Environment names, falling back to the id when a name is unknown, so it needs the Bundle as well as the Lens.
- Wording follows the viewer: `Impact of <name>, <upstream | downstream | both ways>`, `Team <name>`, `Paths from <name> to <name>`. Core's wording today also prints the path mode (`shortest` by default); keep a non-default path mode visible in the unified wording.
- Use it in `src/render/svg.ts:257` (the `Lens:` line of an exported picture), `src/mcp/server.ts:459` (`get_view` text), `viewer/src/LocationBar.tsx:212` (replacing `Workspace.describeLens`, which is deleted) and `website/src/lib/landing.ts:122`.

### Deployment nodes carry their facts

- A Deployment node carries its Deployment Target, and a resolved Deployment View carries its Environment, for Generated and Saved Deployment Views alike.
- `<service>@<target>` remains the node id format. This ticket only adds the fields; the viewer starts reading them in ticket 03.

## Tests

- Default direction: `TB` for `deployment/<env>`, `TB` for a Saved Deployment View with no `direction`, `LR` for `c1`, `c2`, `c2/<system>`, `c3/<service>` and a Saved View at each of those levels; a Saved View's own `direction` wins.
- Lens option: own Lens applied by default on a Saved View with a Lens; no Lens clears it; a given Lens replaces it; on a Generated View the default applies none.
- Lens wording: one test per Lens kind, an unknown id falling back to the id, and a non-default path mode.
- Deployment nodes: every Deployment node of a Generated and of a Saved Deployment View carries its Deployment Target; the View carries its Environment.
- Regenerate the golden SVGs. Only the `Lens:` line may differ (`test/render/golden/saved-lens.svg`); check the diff by eye and say so in the PR.
- An e2e check that a Saved Deployment View with no `direction` lays out top to bottom in the viewer.

## Acceptance criteria

- [ ] A Structural View's `direction` is never undefined; `render/layout.ts` and `viewer/src/place.ts` hold no default direction.
- [ ] A Saved Deployment View with no `direction` draws `TB` in both `archidocs export` and the viewer.
- [ ] No caller passes `undefined` or `null` to mean "own Lens" or "no Lens".
- [ ] One function produces a Lens in words; `grep -rn "Impact of\|impact of" src viewer/src website/src` finds it only in the module.
- [ ] Golden SVG changes are confined to the `Lens:` line.
- [ ] The MCP `get_view` text and exported SVG wording changes are named in the PR description, for the changelog.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
