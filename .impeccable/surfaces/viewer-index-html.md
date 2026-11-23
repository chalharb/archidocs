---
version: 1
slug: "viewer-index-html"
primary_target: "viewer/index.html"
related_targets: ["viewer/src/styles.css"]
---

# Surface: Archidocs viewer

Mode: Operate. Scope: the whole viewer (rail and flyouts, location bar, lens strip, canvas and nodes, Element panel, dialogs, history and error screens, Dynamic View screen), light and dark.

Audience and job: an engineer arriving from a PR, chat or incident link to answer one architecture question (impact, owner, URL, where deployed, ADRs); architects curating Views are secondary. Task behaviour is fixed by ticket 14 and must not change.

Constraints: WCAG 2.2 AA; Team colour always paired with the Team code; the viewer is a self-hosted static site, so fonts ship bundled, never fetched from a CDN; the logo slot stays a placeholder until the user supplies their mark.

Must not feel: louder than the diagram, dev-tool cosplay (terminal, IDE, blueprint), playful.

Memorable moment: the location bar reads as a station sign with a yellow you-are-here tile on the current scope.

## Direction contract

THESIS: The viewer orients like a station: one sign plate says where you are and where each way leads, and the diagram is the map behind it. It refuses the category default of a grey canvas with a blue accent and soft-shadowed cards.

OWN-WORLD: Wayfinding signage. Ground a pale stone (#f3f4f1 light, deep slate in dark), ink a slate-navy #1c2633 that doubles as the sign plate, one wayfinding yellow #ffc629 reserved for you-are-here (current scope, lens origin, focus). Overpass (Highway Gothic lineage) in two chrome sizes, rank by weight, uppercase and reversal; Overpass Mono for ids. Flat fields, 1.5px ink frames, hairlines, no shadows, square corners, one 4px module. Team codes are reversed plate tiles. Nothing fades out unreadably.

STORY: The visitor reads the plate, sees exactly which View and scope the link opened and what is highlighted, reads the answer on the canvas with the key explaining every mark, and acts from the Element panel or the plate (copy link, export, save as View YAML).

FIRST VIEWPORT: 64px labelled rail left (logo slot, Find, Model, Teams, Views). Full-width 52px dark sign plate on top: back/forward, breadcrumb with yellow arrows and a yellow you-are-here tile on the current scope, outlined Deployment tiles, then Recent, direction, Copy link, Export and a white primary Save as View. A white lens strip under the plate when a lens is active. Canvas on stone ground fills the rest, nodes white with ink frames, Team stripe and plate code tile; a KEY panel bottom-left replaces the minimap; square zoom stack bottom-right. Element panel 360px right, white, ink rule, uppercase tab bar with a reversed active tab.

FORM: Wayfinding sign system, candidate 3 of 7 on the grounded list (transit map, survey atlas, wayfinding signage, standards manual, drawing title block, field guide, catalogue card), seed:f13f686c6aa4c22a. Raises: two chrome sizes (timetable rack), no decorative greys (Datamatics), flat fields without shadows (guide map), nothing vanishes (ticket wallet), one 4px module (Crouwel).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
