# How docs pages show diagrams and the live viewer

Type: prototype
Status: resolved
Blocked by: 01
Map: [Archidocs docs site](../map.md)

## Question

How should docs pages show what Archidocs produces? Prototype a concept page or two in the chosen generator, comparing: static SVGs rendered by `archidocs export` at build time, iframes of the live demo viewer (`big-bank.archidocs.dev`), and SVGs with an "open in the live viewer" deep link (`#/view/…?sel=…`). The current lean is the last one. Judge them on clarity, load weight, theme (light and dark), and staying in sync with the example Workspaces.

## Answer

**Docs pages show a static SVG with an "Open in the live viewer ↗" deep link** (variant C). The SVG comes from `archidocs export` of a Saved View in an example Workspace. The link goes to the same View on the demo site, e.g. `https://big-bank.archidocs.dev/#/view/digital:mainframe-outage`. Docs pages never embed the live viewer.

**Why C:**
- It's light, about 28 KB per diagram, with the font embedded.
- It reads at the docs column width.
- Exploring is one click away.

**Why the others lost:**
- **B (iframe):** at the docs column width (~680 px) the viewer switches to its mobile layout and its chrome crowds out the diagram. Every page would also load the whole viewer.
- **D (poster that goes live on click):** it's as light as C, but the inline viewer is just as cramped as B.
- **A (SVG only):** it has no route into the live viewer.

**Facts later tickets depend on:**
- `archidocs export` renders **light only**. On Starlight's dark theme each diagram is a white card. See the "Not yet specified" item on dark-theme diagrams in the map.
- The demo sites allow framing (no `X-Frame-Options` or CSP `frame-ancestors`), and Saved View deep links take the form `#/view/<project>:<view-id>`.
- The diagrams must be rendered from `examples/*` at site build time so they can't drift from the demos. How that happens is part of the content-sources ticket.

## Prototype

Branch `prototype/diagrams-in-docs` (never merged): a throwaway Starlight page `website-prototype-diagrams/` with all four variants, switchable with `?variant=A|B|C|D`. To run it: `pnpm --dir website-prototype-diagrams install --ignore-workspace`, then `pnpm --dir website-prototype-diagrams dev`, then open `/docs/concepts/views/`.
