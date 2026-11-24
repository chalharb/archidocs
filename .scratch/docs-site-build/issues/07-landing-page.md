# 07: Landing page

Status: ready-for-agent
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

- [ ] The rendered page matches the direction contract's FIRST VIEWPORT at 1440×900 and reads well at 390×844.
- [ ] The tool result and diagram come from the build, not from text pasted into the page.
- [ ] WCAG 2.2 AA; yellow is used only for the you-are-here tile.
- [ ] The impeccable finish review is done, and its FINISH line discharged.
