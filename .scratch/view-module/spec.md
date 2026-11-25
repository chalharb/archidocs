# View module

Status: ready-for-agent

One deep module for Views: any View id in, the View out. This spec records the design settled in an architecture review and grilling session on 2026-11-24. Terms follow [GLOSSARY.md](../../GLOSSARY.md); "module", "interface", "seam", "depth", "locality" and "leverage" are used as in the codebase-design vocabulary (a module is anything with an interface and an implementation; its interface is everything a caller must know to use it).

## Problem Statement

Resolving a View is one concept spread over five files in `src/core` that import each other, and every caller has to know how to drive them.

- **Import cycles.** `views.ts` imports `saved-views.ts`, `deployment-views.ts` and `dynamic-views.ts`; the first two import `build` and `ModelIndex` back. `views.ts` and `compare.ts` import each other.
- **Callers order the resolvers.** `resolveView` returns undefined for a Dynamic View id, so `src/cli/main.ts:178`, `src/mcp/server.ts:441-453` and `viewer/src/App.tsx:104-109` each try the dynamic resolver first and the structural one second.
- **Nobody owns the View id grammar.** `c1`, `c2`, `c2/<system>`, `c3/<service>`, `deployment/<env>` and `project:id` are string-sliced in `views.ts`, `dynamic-views.ts:198-204`, `rules.ts:762`, `save-as-view.ts:51`, and across the viewer (`workspace.ts`, `place.ts:42`, `Rail.tsx:51`, `:224-227`, `Canvas.tsx:43`).
- **Direction is known in four places, and they disagree.** `deployment-views.ts:96` sets `TB`; `render/layout.ts:79` defaults to `LR`; the CLI uses the resolved View's direction; the viewer derives it from the id prefix (`place.ts:42`, `App.tsx:110`). A Saved Deployment View is stored as `kind: "structural"`, `level: "deployment"` with a `project:id` id, so with no `direction` of its own it exports `TB` from the CLI and lays out `LR` in the viewer. This was found by reading the code and has not been reproduced by running it.
- **The Lens option is a tri-state.** `ResolveOptions.lens` means "keep the Saved View's own Lens" when undefined and "clear it" when null. The viewer wraps this with a `null` default, `ownLens` and `pickView`.
- **A Lens in words is written three times**, differently: `saved-views.ts:125` (ids), `viewer/src/workspace.ts:130-134` (names), `website/src/lib/landing.ts:122`.
- **Deployment node ids are parsed outside the resolver.** `viewer/src/Canvas.tsx:42` slices `<service>@<target>` at the last `@`, and `:43` gets the Environment from the View id, which yields none for a Saved Deployment View.
- **The viewer's `Workspace` has pass-through methods** onto core: `resolve`, `picked`, `saveAsView`, `dynamic`, `stepViews`, `otherDynamicViews`.

## Solution

A View module at `src/core/views/` with one entry. Callers hand it a Bundle and a View id and get back whichever kind of View that id names. The module owns the View id grammar, the default direction, the Lens wording, Compare and Save as View. The four resolvers become private files behind the entry.

## Implementation Decisions

### Packaging

- The module is the folder `src/core/views/`. Its index is the only file imported from outside the folder.
- It is browser-safe (no `node:` imports), so the viewer imports the same entry as the CLI and MCP server.
- Private files hold the Generated, Saved, Deployment and Dynamic resolvers, Lens application, Compare, Save as View and the id grammar.
- `build`, `ModelIndex`, `applyLens`, `resolveSaved` and `resolveDynamic` are no longer exported. The npm package publishes only the `archidocs` binary, so this breaks no outside caller.
- `ModelIndex` stays private to the module and is built once per resolve call, not twice.
- `unionBundle` stays in `src/core/compare.ts`; only the View-marking half of Compare moves in.

### Interface

Exact names and parameters are settled in [ticket 01](issues/01-view-module.md). The interface holds:

- **Resolve**: a Bundle and any View id in; a Structural View or a Dynamic View out, told apart by `kind`. An unknown id returns undefined; "did you mean" suggestions stay with callers.
- **Resolve with problems**: the check-facing entry. It returns a View with what `check` reports about it, in today's shapes: a Saved View's bad `expand`/`collapse` entries and unresolved paths, and a Dynamic View's Step problems. It also gives `oversized-view` every Generated View resolved.
- **List Views**, with the existing kind and Element filters.
- **Compare**: a View id resolved across two Bundles, every node and edge marked.
- **Save as View**: a viewer screen in, a Saved View definition out.
- **The picked subset** of a resolved View.
- **The View id grammar**: what kind of id this is, an Element's own View, an Environment's Deployment View, the Generated Views holding a Step. View ids stay plain strings in URLs and the Bundle; only the module parses or builds them.
- **A Lens in words.**

Structural-only callers narrow on `kind`.

### Behaviour changes

- **Direction is always set** on a Structural View: the Saved View's own, else `TB` for a Deployment View, else `LR`. The defaults in `render/layout.ts:79` and `viewer/src/place.ts:42` go. The viewer then draws a Saved Deployment View with no `direction` top to bottom, matching the CLI.
- **The Lens option is an explicit three-way choice**: the View's own Lens (the default), no Lens, or a given Lens. CLI and MCP behaviour is unchanged; the viewer passes its choice explicitly.
- **One Lens wording**, using Element, Team and Environment names, falling back to the id when a name is unknown. It follows the viewer's wording: `Impact of <name>, <upstream | downstream | both ways>`, `Team <name>`, `Paths from <name> to <name>`. Core's wording today also prints the path mode; the unified wording keeps a non-default path mode visible. This changes the Lens line in exported SVGs and the text of MCP `get_view`. MCP's structured Lens data still carries ids.
- **Deployment nodes carry their facts**: a Deployment node carries its Deployment Target, and a resolved Deployment View carries its Environment. `<service>@<target>` remains the node id format, and nothing outside the module parses it.

### Viewer

- `Workspace` loses `resolve`, `picked`, `saveAsView`, `dynamic`, `stepViews`, `otherDynamicViews`, `ownLens`, `ownDirection`, `describeLens`, `ownView` and `deploymentViews`. Screens call the View module on `workspace.bundle`.
- `Workspace` keeps names, Teams, crumbs and the rail trees. Those use the module for anything about View ids.
- `viewer/src/place.ts` loses `defaultDirection`.

## Testing Decisions

- The interface is the test surface. No test imports a private file of the module.
- The existing tests are re-pointed at the module's entries, using a fixture Workspace and a View id: `test/core/views.test.ts`, `saved-views.test.ts`, `dynamic-views.test.ts`, `deployment-views.test.ts`, `compare.test.ts`, `picked-view.test.ts`, `save-as-view.test.ts` and `test/mcp/views.test.ts`. A test that reaches `build`, `ModelIndex` or `applyLens` is rewritten to go through the interface.
- New unit tests cover the View id grammar, the default direction (including a Saved Deployment View with no `direction`), the three-way Lens option and the Lens wording.
- Golden SVGs in `test/render/golden/` change only in ticket 02, and only on the Lens line.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm test:e2e` pass at the end of every ticket.

## Build Tickets

| # | Ticket | Commit type | Blocked by |
|---|---|---|---|
| 01 | [View module behind one entry](issues/01-view-module.md) | `refactor(core)` | None |
| 02 | [Direction, Lens option and Lens wording](issues/02-direction-lens-wording.md) | `fix(views)` | 01 |
| 03 | [Viewer uses the View module](issues/03-viewer-uses-view-module.md) | `refactor(viewer)` | 02 |

Ticket 01 changes no behaviour. Ticket 02 holds every user-visible change, so it gets its own changelog line.

## Out of Scope

- **One Model index per Bundle** for every query, the renderers and the viewer. `ModelIndex` stays private to this module.
- **`Workspace.deployedIn` and `opening`** in the viewer, which resolve whole Views to answer small questions. They belong with lifting Place transitions out of `Screen`.
- **A "picture of a View" module** over layout and the renderers. This module makes it cheaper; it is a separate piece of work.
- **The `src/core/index.ts` barrel** beyond re-pointing its View exports.

## Further Notes

- No ADR: nothing here is hard to reverse.
- `GLOSSARY.md` gained **View id** and **Structural View** during the session.
- Interface alternatives were not explored in parallel. The one part still open in shape is how the View id grammar is exposed (a parsed id value, or a handful of question functions); ticket 01 decides it.
