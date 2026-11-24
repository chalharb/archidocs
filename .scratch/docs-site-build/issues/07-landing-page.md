# 07: Landing page

Status: done
Blocked by: 04
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

The archidocs.dev landing page at `website/src/pages/index.astro`. It's "Twin screens" ([landing page](../../docs-site/issues/06-landing-page.md)), built with the `impeccable` skill against the direction contract in `.impeccable/surfaces/website-src-pages-index-astro.md` and `DESIGN.md`. The prototype is on branch `prototype/landing-page` (`website-prototype-landing/index.html`, variant A).

- **Hero:** a slate plate with the headline, lede, **Open the Big Bank demo** (primary) and **Read the quick start**.
- **Twin panes:** an "asked twice" question bar, then the panes:
  - the agent transcript, with the real `get_impact(core:mainframe, upstream)` result **captured at build time** from the MCP server over `examples/big-bank`
  - the viewer pane: sign plate with the yellow you-are-here tile, the Impact lens strip, and the light diagram
- **Below:** the YAML that splits into the viewer and MCP, then the six persona questions with each one's viewer lens and MCP tool.
- **Assets:** self-hosted Overpass, the brand marks from `assets/brand/`. No testimonials or figures.

## Acceptance criteria

- [x] The rendered page matches the direction contract's FIRST VIEWPORT at 1440×900 and reads well at 390×844.
- [x] The tool result and diagram come from the build, not from text pasted into the page.
- [x] WCAG 2.2 AA; yellow is used only for the you-are-here tile.
- [x] The impeccable finish review is done, and its FINISH line discharged.

## Comments

### Build notes (2026-11-23)

- **Capture:** `website/src/lib/landing.ts` starts the MCP server in-process over `examples/big-bank/archidocs` and calls `get_impact`, `get_view` (`digital:mainframe-outage`) and `listTools`. The build fails if the View's upstream lens marks differ from the `get_impact` set, if a persona row names a tool the server doesn't list, or if the result is truncated.
- **Ten, not nine:** the real result has 10 upstream Elements (the prototype and the contract said nine). The page renders whatever the build captures.
- **Map:** the light export of the Saved View, cropped at build time to its own node geometry (`cropDiagram`, no title or legend), served at `/landing/map.svg` and shown at 85% in a pane that pans. It opens on the origin; on narrow screens a small script opens it on the direct ring.
- **YAML:** the excerpt is the block of the first directly affected Service whose own Relationship puts it in the result, located from that Relationship's `source` line in the tool output.
- **Yellow:** only the viewer pane's you-are-here tile. Crumb chevrons are plate-muted and focus on the plate is white (recorded in DESIGN.md as the Pictured Yellow Rule). The exported map keeps its own yellow lens origin.
- **No React:** the expandable call is a `<details>`; `@astrojs/react` isn't added.
- **Fonts:** the viewer's own Overpass woff2 files, imported from `viewer/src/fonts/`.
- **Checks:** `website/e2e/landing.spec.ts` (agreement, yellow, same-origin fonts and pictures, tool links, 390 layout and map scroll) and `website/test/landing.test.ts`.
