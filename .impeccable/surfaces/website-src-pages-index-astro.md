---
version: 1
slug: "website-src-pages-index-astro"
primary_target: "website/src/pages/index.astro"
related_targets: []
---

# Surface: archidocs.dev landing page

Mode: Persuade. Scope: the landing page at `/` of archidocs.dev (the docs under `/docs/` are a separate Read surface on Starlight's theme). Not built yet: the [docs-site spec](https://github.com/chalharb/archidocs/blob/2ada153523e46f6f5f9ce1700678f431c7b5cdb0/.scratch/docs-site/spec.md) decides it; a later build effort makes it.

Audience and job: people deciding whether to adopt Archidocs (platform, architecture and engineering leads). They should believe that people and agents get the same answer from one Model, then open the Big Bank demo. Secondary action: the quick start.

Proof on hand: real Big Bank output only (an `archidocs export` diagram, a real MCP tool result, a real Project YAML file), the six persona questions. No testimonials, adoption figures or logos exist; never invent any.

Constraints: the established Wayfinding Plate world (DESIGN.md); WCAG 2.2 AA; fonts self-hosted; the One Yellow Rule holds here too (yellow only marks you-are-here, e.g. the current View tile).

Must not feel: SaaS template (feature-card grid, metrics hero), dev-tool cosplay, louder than the diagrams.

Memorable moment: one question asked twice, answered side by side by an agent over MCP and by the viewer, and the answers agree.

## Direction contract

THESIS: One question, two readers, one answer. The page proves "same answers for people and agents" by showing both answering the same question side by side, and refuses the category default of a hero headline over a grid of feature cards.

OWN-WORLD: The Wayfinding Plate: slate plate fields own the hero and footer, stone ground below, white panes with 1.5px ink frames, square corners, no shadows. Overpass 800 display for headlines, Overpass Mono for ids, tool calls and YAML. Yellow appears once, as the viewer's you-are-here tile.

STORY: The visitor reads the claim, sees a real question answered by an agent (`get_impact`) and by the viewer (Impact lens) with the same nine Elements, learns both come from the YAML their Teams already review, scans the six persona questions with their viewer lens and MCP tool, and opens the live demo.

FIRST VIEWPORT: Full-width slate plate. 60px top bar: mark and wordmark left; Docs, Examples, Changelog, GitHub right. Headline at ~76px, max 15ch, left; lede 20px below; primary white "Open the Big Bank demo" button and ghost "Read the quick start". Under them a framed "asked twice" question bar, then the twin panes: agent transcript with an expandable real tool result (5/12 width) beside a viewer pane with the sign plate, yellow current-View tile, Impact lens strip and the exported diagram (7/12). The panes start inside the first viewport.

FORM: Twin screens, candidate 5 of 7 on the ordered list (twin screens, route map, annotated specimen among them), seed:5b51a3d49902e698 (recorded by the ticket-06 prototype session; `concept-seed --check-seed` can't verify it on the build machine, so treat the roll as unverified). Signature interaction: expanding the MCP call reveals the real JSON the agent read.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
