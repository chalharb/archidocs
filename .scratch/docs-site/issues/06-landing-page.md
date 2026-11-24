# What the landing page looks like

Type: prototype
Status: resolved
Blocked by: 01
Map: [Archidocs docs site](../map.md)

## Question

What does the archidocs.dev landing page look like and say? Prototype it with the `impeccable` skill against `DESIGN.md`, `PRODUCT.md` and `assets/brand/`: the hero, the persona questions, how a live diagram or demo appears, and the paths into the docs and demos. No fabricated testimonials or adoption figures (see `PRODUCT.md`).

## Answer

**Twin screens** (variant A). The page proves "same answers for people and agents" by answering one real question twice, side by side. The page runs in this order:

1. **Hero:** a slate sign plate in the Wayfinding Plate style.
   - Headline: "One architecture. Same answer for people and agents."
   - A one-paragraph lede.
   - The primary button **Open the Big Bank demo**, and a secondary **Read the quick start**.
2. **Twin panes:** under the hero, an "asked twice" question bar ("What does a mainframe outage take down?"), then two panes:
   - **Left:** an agent transcript with the real `get_impact` call. The call expands to show the JSON the agent read.
   - **Right:** the viewer pane: its sign plate with the yellow you-are-here tile, the Impact lens strip, and the exported diagram.
   - A link opens the same View live.
3. **Source:** a real Project YAML file splitting into "for people: the viewer" and "for agents: the MCP server".
4. **Six persona questions:** a table with each question's viewer lens and MCP tool.

**Why A won over the others:**
- **B (route map):** a stronger metaphor, but the claim only lands after interaction.
- **C (annotated specimen):** diagram-first, but the two answers sit below the fold.

**Rules for the build:**
- **Proof is only real Big Bank output:** an export, a tool result, a YAML file. No testimonials or figures.
- **Brand rules hold:** yellow only marks you-are-here, and the visitor chose the demo as the primary action.
- **The tool result is captured, not hand-written:** the build should capture it from the real MCP server at build time, the same way the diagrams are exported (see the content-sources ticket).

**Direction contract** for the build effort: `.impeccable/surfaces/website-src-pages-index-astro.md`. It covers THESIS, OWN-WORLD, STORY, FIRST VIEWPORT and FORM, with seed `seed:5b51a3d49902e698`.

**Fact for later tickets:** `archidocs export` stamps each SVG's header with the checkout folder name and commit, e.g. `ticket-26-publishing-ci-065f52 · ce6dd3a`. The site build has to set a meaningful label there.

## Prototype

Branch `prototype/landing-page` (never merged): `website-prototype-landing/index.html` holds all three variants, switchable with `?variant=A|B|C`. To run it: `python3 -m http.server 4401 --directory website-prototype-landing`, then open `/?variant=A`.
