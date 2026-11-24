# How diagrams look on the dark theme

Type: grilling
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

`archidocs export` renders light only, so on Starlight's dark theme each diagram is a white card. Options: keep white cards on purpose; add a dark theme to `export` and swap the image with `prefers-color-scheme` / Starlight's theme; or a transparent background with colours that work on both. The prototype on `prototype/diagrams-in-docs` shows the white-card look today.

## Answer

**Finding:** the SVG export predates the Wayfinding Plate look. `src/render/svg.ts` and `sequence-svg.ts` hard-code an older palette:
- ink `#1b2330`, where the viewer uses `#1c2633`
- lens orange `#c2410c`, where the viewer uses Upstream Rust `#a4461a`
- elements the Lens doesn't touch are faded to 35% opacity, which `DESIGN.md` forbids

The export also has no dark version, while the viewer has a full "Night shift" palette.

**Decisions:**
- **Match the viewer** (a build-effort ticket): restyle the export to the Wayfinding Plate tokens, with the same colours, frames and stepped-back styling as the viewer and **no opacity fades**. Read the palette from **one shared token source** that the viewer's CSS also uses, so the two can't drift.
- **Dark export:** `archidocs export` gains `--theme light|dark`. Dark uses the viewer's Night shift tokens. The default stays light, so READMEs and wikis don't change.
- **Docs pages:** the site build renders both themes and shows the one matching **Starlight's theme** with CSS on `[data-theme]`. `<picture>` with `prefers-color-scheme` alone wouldn't follow Starlight's manual switch.
- **Landing page:** stays light only, with no swap.
- **Other uses:** the Action's `images: true` and slide exports get the new styling automatically. Dark is only by `--theme dark`. An Action `theme` input is out of scope for this map.
