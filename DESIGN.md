---
name: Archidocs
description: A static architecture viewer that orients like a station, with one sign plate and the generated diagram as the map behind it.
colors:
  ground: "#f3f4f1"
  paper: "#ffffff"
  ink: "#1c2633"
  muted: "#4f5966"
  faint: "#616a76"
  line: "#c4c9c1"
  rule: "#e2e4df"
  tint: "#e8eae5"
  plate: "#1c2633"
  on-plate: "#ffffff"
  plate-muted: "#c3cbd6"
  plate-line: "#48566b"
  here: "#ffc629"
  on-here: "#1c2633"
  herebg: "#fff4cc"
  edge: "#5b6573"
  edge-faint: "#80878f"
  up: "#a4461a"
  upbg: "#fbeee6"
  down: "#1d5fa8"
  downbg: "#e8f0fa"
  path: "#5b3aa8"
  pathbg: "#efeaf9"
  added: "#1f7a4d"
  removed: "#b3261e"
  changed: "#9a6200"
  note-line: "#d9a600"
typography:
  headline:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  body-strong:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.45
  plate-heading:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    letterSpacing: "0.08em"
  label:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
  label-strong:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.08em"
  mono:
    fontFamily: "Overpass Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
  landing-display:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(42px, 5.3vw, 76px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  landing-headline:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.3vw, 46px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  landing-title:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.2
  landing-lede:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.5
  landing-question:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  landing-body:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  landing-small:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  landing-button:
    fontFamily: "Overpass, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.08em"
  landing-mono:
    fontFamily: "Overpass Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  none: "0px"
  datastore-base: "12px"
  person-pill: "28px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  tool-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  tool-button-hover:
    backgroundColor: "{colors.tint}"
  tool-button-on-plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.on-plate}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  primary-button:
    backgroundColor: "{colors.on-plate}"
    textColor: "{colors.plate}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  primary-button-hover:
    backgroundColor: "{colors.plate-muted}"
    textColor: "{colors.plate}"
  here-tile:
    backgroundColor: "{colors.here}"
    textColor: "{colors.on-here}"
    typography: "{typography.plate-heading}"
    rounded: "{rounded.none}"
    padding: "4px 10px 3px"
  team-code-tile:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    padding: "1px 6px 0 5px"
  location-plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.on-plate}"
    padding: "8px 16px"
    height: "52px"
  rail:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    width: "64px"
  rail-button-active:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.on-plate}"
  node:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.none}"
    padding: "10px 14px"
  way-in-tile:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    width: "22px"
    height: "22px"
  tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    padding: "10px 8px 9px"
  element-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    width: "340px"
  map-key:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    width: "264px"
  landing-button-primary:
    backgroundColor: "{colors.on-plate}"
    textColor: "{colors.plate}"
    typography: "{typography.landing-button}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  landing-button-primary-hover:
    backgroundColor: "{colors.plate-muted}"
    textColor: "{colors.plate}"
  landing-button-ghost:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.on-plate}"
    typography: "{typography.landing-button}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  asked-bar:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.on-plate}"
    typography: "{typography.landing-question}"
    rounded: "{rounded.none}"
    padding: "16px 20px 14px"
  pane:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  pane-head:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label-strong}"
    padding: "10px 16px 9px"
  tool-call:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.landing-mono}"
    rounded: "{rounded.none}"
    padding: "10px 12px 9px"
  tool-call-hover:
    backgroundColor: "{colors.tint}"
  tool-call-result:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
    typography: "{typography.landing-mono}"
    padding: "12px"
  file-block:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.landing-mono}"
    rounded: "{rounded.none}"
  file-block-marked-line:
    backgroundColor: "{colors.upbg}"
  persona-table:
    textColor: "{colors.ink}"
    typography: "{typography.landing-small}"
---

# Design System: Archidocs

## Overview

**Creative North Star: "The Wayfinding Plate"**

The viewer orients like a station. One dark sign plate across the top says where you are and where each way leads; the generated diagram is the map behind it, on a pale stone ground. Everything in the chrome is built from signage materials: flat painted fields, 1.5px ink frames, hairline rules, reversed tiles, uppercase labels and a single wayfinding yellow that means only "you are here".

Density is operational, not decorative. Two chrome type sizes do all the ranking, by weight, case and reversal rather than by size, so the plate reads at a glance and the canvas keeps the visual weight. Nothing fades out unreadably: a stepped-back edge is a fainter solid stroke that still holds about 3:1 against the ground, and dimmed nodes stay legible. Dashes are never borrowed for stepping back, because dashes carry meaning: External frames and open boxes, removed Relationships in Compare, and Return steps and lifelines in sequence charts.

Dark mode is the same station after dark: the ground drops to deep slate (#10151c), paper to #18202a, ink inverts to #e6eaef, and the plate stays a lit slate-navy sign (#1f2a3a) a step above the ground. The yellow does not change.

The landing page at archidocs.dev is a persuade surface in the same world, read rather than operated. It is the station's signage at a reading distance: slate plate fields hold the hero and the close, the stone ground runs between them, and the proof sits in white panes framed at 1.5px with square corners and no shadows. It keeps the viewer's colours, fonts and frames and adds a larger reading ramp; it is light only.

**Key Characteristics:**
- One dark sign plate (52px) over the canvas; one labelled rail (64px) on the left.
- One yellow, reserved for you-are-here.
- Square corners everywhere in the chrome; shape carries meaning only on nodes.
- No shadows. Depth is reversal (plate against ground) and ink frames.
- Two chrome type sizes, 13px and 11px, in Overpass; Overpass Mono for ids.
- Team ownership always shown as a colour stripe paired with a reversed code tile.
- The landing page: plate fields top and bottom, stone between, white framed panes, a reading ramp of its own, yellow only inside the pictured viewer.

## Colors

A stone-and-slate signage palette with one wayfinding yellow and a small set of semantic lens and history colours; there are no decorative greys.

### Primary
- **Station Slate** (ink / plate): text, every 1.5px frame, the sign plate, reversed tiles and active states. In light mode the ink and the plate are the same slate-navy, so the plate reads as ink poured into a field.
- **Wayfinding Yellow** (here): the you-are-here mark. It fills the current scope tile on the plate, the arrows between breadcrumbs, the current Deployment tile, the selection ring, the lens origin badge and ring, and text selection. On reversed or ink fields (the plate, flyout heads, the Key summary, the selected tab, the checked segmented option) it is also the focus outline, because the ink outline would vanish there.
- **Here Wash** (herebg): the quiet form of the yellow for the current row in a tree, the current Step in a Dynamic View outline and the lens-origin node fill.

### Secondary
- **Upstream Rust** (up / upbg) and **Downstream Blue** (down / downbg): Impact lens direction, as fills, badges and Key swatches; always accompanied by an arrow and a word.
- **Path Violet** (path / pathbg): the Connect-to path lens.
- **Added Green**, **Removed Red**, **Changed Amber** (added / removed / changed): history and Compare marks, always paired with a glyph or label.

### Neutral
- **Stone Ground** (ground): the canvas and page background.
- **Paper** (paper): rail, flyouts, nodes, the Element panel, the Key, the lens strip.
- **Muted Slate** (muted) and **Faint Slate** (faint): secondary text and sub-labels; both pass AA on paper and ground.
- **Stone Line** (line): quiet frames such as tool buttons on paper and Deployment Target containers.
- **Stone Rule** (rule): hairlines between sections and broker stripes.
- **Stone Tint** (tint): hover fills and collapsed-System fill.
- **Plate Muted** / **Plate Line**: secondary text and button frames on the plate.
- **Edge** / **Edge Faint**: Relationship lines; a stepped-back edge (faded by a lens, unchanged in Compare, a later Step) is drawn as a solid Edge Faint stroke at full opacity, never faded and never dashed.

### Named Rules
**The One Yellow Rule.** The yellow means you-are-here and nothing else: current scope, crumb arrows, current Deployment, selection, lens origin, and focus on reversed or ink fields. It is never a brand accent, a hover, a warning or a highlight for emphasis.

**The Stripe-And-Code Rule.** A Team's generated colour never appears alone. It is the 5–6px left edge of a node or code tile, always beside the Team code in a reversed tile.

**The No Decorative Greys Rule.** Every neutral has a job named above. A new grey needs a role, not a mood.

**The Pictured Yellow Rule.** On the landing page the yellow appears only as the you-are-here tile inside the pictured viewer pane. Its crumb chevrons there are plate-muted, focus outlines on plate fields are white (on-plate) and on light fields ink, and text selection is ink on light fields and plate-muted on the plate. The exported diagram image carries the export's own yellow lens origin; that is product output, not page chrome. Upstream rust (up) labels the upstream counts, and upstream wash (upbg) marks the line a file block points at.

## Typography

**Body Font:** Overpass (ui-sans-serif, system-ui, sans-serif), self-hosted variable woff2, SIL OFL.
**Label/Mono Font:** Overpass Mono (ui-monospace, SF Mono, Menlo, monospace), self-hosted, for ids and code.

**Character:** Overpass descends from Highway Gothic, the road-sign face, so the chrome reads as signage rather than as an app. Tabular figures are on globally.

### Hierarchy
- **Headline** (800, 22px, 1.15): the selected Element's name at the head of the Element panel. The only large type in the chrome.
- **Plate Heading** (800, 13px, 0.08em, uppercase): flyout titles and the you-are-here tile.
- **Body** (400, 13px, 1.45): the base size for everything; node names set it at 700, breadcrumbs at 600.
- **Label** (700, 11px, 0.04–0.06em, uppercase): rail labels, tool buttons, tabs, Deployment tiles, segmented controls, Element kind, node sub-labels (sub-labels in sentence case, 400).
- **Label Strong** (800, 11px, 0.06–0.1em, uppercase): Team code tiles, View tags, the Key summary, the lens kind tile, group headings in trees.
- **Mono** (400, 11px): Element ids beside the kind label.

### Named Rules
**The Two Sizes Rule.** Chrome is set in 13px and 11px only. Rank comes from weight (400 to 800), uppercase and reversal, never from a third size. The Element name headline (22px) and long-form reading surfaces (the ADR reader's Markdown) are content, not chrome.

**The Signage Case Rule.** Controls and labels are uppercase with positive tracking; names of things in the Model (Elements, Views, scopes in the breadcrumb other than the current one) keep their own case.

### Landing reading ramp
The landing page is a reading surface, so it sits outside the Two Sizes Rule with a ramp of its own, all Overpass and Overpass Mono from the viewer's self-hosted woff2 files, tabular figures on.
- **Landing Display** (800, 42–76px clamp, 1.02, -0.025em): the hero headline, at most 15ch wide.
- **Landing Headline** (800, 30–46px clamp, 1.08, -0.02em): section and close headings.
- **Landing Title** (800, 21px, 1.2): titles inside framed output cards.
- **Landing Lede** (400, 20px, 1.5, plate-muted): the hero lede; drops to 17px under 720px.
- **Landing Question** (700, 20px, 1.3): the question in the "asked twice" heading bar.
- **Landing Body** (400, 17px, 1.55): the base reading size; section paragraphs run 56–62ch in muted.
- **Landing Small** (400, 15px): the transcript, captions, card copy, the persona table and the footer. Persona questions step up to 17px 700.
- **Landing Button** (800, 12px, 0.08em, uppercase): button and card-link labels.
- **Landing Mono** (13px): tool calls, JSON, YAML, hosts and tool names; file-block heads use 12px 600.
- **Label Strong** (800, 11px, 0.08em, uppercase) is shared with the viewer: pane heads, run-in labels, table heads and counts. Top navigation links use 11px 700.
- The pictured viewer pane keeps the viewer's own chrome sizes: 13px 600 crumbs and the 13px 800 you-are-here tile.

**The Reading Ramp Rule.** The landing ramp belongs to reading surfaces only. It never enters viewer chrome, and the viewer's chrome inside a landing pane keeps 13px and 11px.

## Layout

A fixed shell: a 64px rail (56px under 640px) and a main column whose first row is the location plate (min 52px, wrapping rather than widening) and whose second row is the canvas. Flyouts (320px) open beside the rail over a 12% slate scrim. The Element panel (340px) sits on the right edge of the canvas only while something is selected. When a lens, Compare or open boxes are active, a paper state strip spans the plate's full width beneath it, ruled off in ink.

Spacing runs on one 4px module: 4, 8, 12, 16, 20, 24. Controls are 32px tall, tree rows 32px, rail buttons 52px; the Key sits 16px in from the canvas corner. Under 640px the plate tightens its padding and its tools wrap below the breadcrumb, and the Dynamic View screen stacks chart, walkthrough and Step detail into one scrolling column.

The landing page runs in a 1256px wrap with a fluid gutter (20–40px, 2.8vw). A 60px top bar on the plate is ruled off in plate-line. The hero, the "asked twice" bar and the twin panes share one plate field; the source section and the persona table sit on stone; the close and footer return to the plate. The twin panes split 5/12 (agent transcript) to 7/12 (viewer pane) with a 1.5px plate-line gutter, and the source section splits file block, a 72px joint arrow and the output cards. Sections open with 64–104px of space. Under 960px the twin panes and the source split stack and the joint arrow turns down; under 720px buttons fill the width, the wide nav links drop, and the persona table becomes stacked rows with inline cell labels.

## Elevation & Depth

The system is flat. Depth comes from reversal (the slate plate over stone, the reversed active tab and code tiles) and from 1.5px ink frames that separate rail, flyouts, panel and Key from the canvas. There are no drop shadows anywhere; the canvas library's control shadows are explicitly turned off. The landing page has no box-shadows at all; its panes are separated by 1.5px frames and by the plate field behind them.

### Shadow Vocabulary
The only box-shadows are zero-blur state rings, drawn outside the frame so the frame never moves:
- **Selection ring** (`box-shadow: 0 0 0 2px var(--ink), 0 0 0 6px var(--here)`): the selected node, ink inside yellow.
- **Lens origin ring** (`box-shadow: 0 0 0 4px var(--here)`): the node a lens started from.
- **Team ring** (`box-shadow: 0 0 0 4px var(--team)`): nodes ringed by the Team lens.
- **Added ring** (`box-shadow: 0 0 0 2px var(--added)`): nodes added in Compare.

### Named Rules
**The Flat Plate Rule.** Surfaces are flat at rest and in every state. A state is shown by a zero-blur ring, a fill or a reversal, never by lift.

## Shapes

Every chrome surface has square corners (radius 0): buttons, tiles, tabs, flyouts, panels, the Key and the zoom stack. Corners are spent only on nodes, where shape is an encoding the Key explains: a Person is a pill (28px radius), a datastore Service has a rounded base (0 0 12px 12px), a broker carries vertical stripes, an External has a dashed frame with a solid Team edge, an open box (container) is a dashed frame on a translucent tint, and a Deployment Target is a quiet solid line frame. A collapsed System is tinted with a 2px frame.

**The Dash Means Something Rule.** A dash is reserved for External frames and open boxes on nodes, removed Relationships in Compare, and Return steps and lifelines in sequence charts. Nothing else is dashed, stepped-back edges included.

Pictograms are authored on a 16-unit grid with a single 1.75 stroke, square caps and mitred joins, in the current text colour, at 16px (20px in the rail). Chevrons and arrows drawn in CSS masks use the same square, mitred line.

## Components

### Buttons
Painted sign buttons: square, framed, uppercase.
- **Shape:** square (0), 32px tall, 1.5px frame, 12px horizontal padding, Label type, icon gap 8px.
- **Tool (on paper):** paper fill, stone-line frame, ink text; hover fills with tint.
- **Tool (on the plate):** transparent with a plate-line frame and white text; hover brightens the frame to plate-muted.
- **Primary:** a white plate on the slate sign (Save as View), slate text; hover drops to plate-muted. One per plate.
- **Focus:** a 2.5px outline that matches the field it sits on: ink on light fields (paper buttons, unselected tabs, unchecked segmented options), yellow only on reversed or ink fields (the plate, flyout heads, the Key summary, the selected tab, the checked segmented option).

### Segmented control
A framed strip of uppercase options divided by 1.5px ink rules; the chosen option reverses to ink with paper text. Used for lens direction and grouping choices.

### Location plate (signature)
The station sign. Back and forward as square 32px tools, then the breadcrumb at 13px semibold in plate-muted with a yellow arrow before each step, ending in the yellow you-are-here tile (uppercase, 800). Deployments follow as outlined uppercase tiles, the current one filled yellow. Recent, direction, Copy link, Export and the white primary sit at the right. After the you-are-here tile, a Go deeper tool lists the Views one level down, so the scope ladder is walked both ways from the plate.

The plate reflows on purpose, never by accident. From 900px it is one row: the ladder takes what the Deployment tiles and tools leave, and gives up width before anything wraps (earlier scopes shorten to an ellipsis first, the you-are-here tile last; each keeps its full name in a tooltip). Under 1280px the secondary tools drop their words and keep their pictograms. Under 900px it is two rows: where you are, then Deployment tiles and tools. Under 640px the ladder shortens to the way up and where you are, the tools fill their row as equal 40px keys with nothing scrolled out of sight, and a menu opens as a sheet across the plate.

### Rail and flyouts
Paper rail with an ink rule on its right edge, the Archidocs mark at the top (the "Doorway tile": its tile drawn in ink so it follows light and dark mode, its keystone in brand indigo `#5146E5`; see `assets/brand/`), and icon-over-label buttons that reverse to the plate when their flyout is open. Flyouts have a plate-coloured head with an uppercase title and a framed square close button; tree rows are 32px, hover tint, current row in here-wash with an 800 label.

### Team code tile
The reversed plate tile: ink fill, paper text, 11px 800 tracked code, with the Team colour as a 5px leading band. It appears on every node, in trees, in the Element panel owner line and in the Key.

### Nodes (signature)
Paper box with a 1.5px ink frame and a 6px Team-coloured left edge; one head row of expand toggle, kind pictogram, bold name and Team code tile, with an 11px muted sub-label beneath. Shape encodes kind (see Shapes). A box is laid out wide enough for its name: its kind's size, widened in 10px steps up to 360px, past which the name takes a second line; an open box is at least as wide as its head row needs. Padding is 10px by 14px, so the head row breathes. Where a box has a View of its own, a reversed ink arrow tile (22px, the "way in") ends its foot row, or its head row on an open box; the + beside the name opens the box here, the tile goes down a level, and a double-click still does the same. Lens badges sit on the top edge as small filled tiles (Upstream rust, Downstream blue, Origin yellow), each with an arrow or mark and a word.

### Map Key
Replaces the minimap, bottom-left. A 264px paper card with an ink frame and a plate-coloured summary bar ("KEY", 11px 800, 0.1em) that collapses it. Each row pairs a 28x16 swatch drawn in the canvas's own vocabulary (code tile, dashed, striped, origin ring, up and down fills, held mark) with a sentence.

### Element panel and tabs
A 340px paper panel ruled in ink on its left. Head: the 22px headline name, an uppercase kind label with the mono id, the owner tile. Tabs run full width, uppercase 11px muted, ruled above by a hairline and below by ink; the active tab is reversed to ink. Actions in the panel body are full-width framed rows with a pictogram.

### Lens chip
A framed chip whose leading cell is a reversed ink tile naming the lens kind (IMPACT, PATH), followed by the plain-language description and a clear control.

### Landing buttons
Larger painted sign plates for a reading page: square, 44px tall, 18px horizontal padding, 1.5px frame, Landing Button type, a 16px pictogram after the label with a 10px gap. They sit on the plate only.
- **Primary:** white plate (on-plate) with slate text; hover drops fill and frame to plate-muted.
- **Ghost:** transparent with a plate-line frame and white text; hover brightens the frame to plate-muted.
- **Focus:** a 2.5px white outline, offset 2px. Fill and frame changes run 150ms ease-out and are off under reduced motion. Under 720px they fill the width with the pictogram pushed to the end.

### "Asked twice" bar and twin panes (signature)
The heading bar is the h2 itself: a 1.5px plate-line frame, open at the bottom so it joins the panes, holding a plate-muted Label Strong run-in ("Asked twice") on the same line as the question in Landing Question type. The label runs in beside the question; it is not an eyebrow above it. Beneath, two paper panes share one plate-line frame, split 5/12 to 7/12 with a 1.5px gutter. Each pane opens with a ground-filled head ruled off in ink: a Label Strong name on the left and a muted 13px mono host or command on the right. The right pane pictures the viewer with its own chrome: location plate, lens strip with a lens chip, then the map. The map is the build's export cropped to its node geometry (12px margin; no title or legend) and shown at 85% scale on stone, in a focusable right-to-left scroll container, so it opens on the origin at its right edge without script. Where the pane is too narrow to show the direct ring beside the origin, a small script opens it on that ring instead. Above 960px the map is size-contained (at least 340px tall): it takes the agent pane's height and pans inside it rather than stretching the row. Under it, a "Scroll for the whole map" foot in muted Label Strong with a left-arrow pictogram sits below a stone rule.

### Tool call
A transcript tool call as a disclosure in a 1.5px ink frame. The summary row holds a 10px chevron that turns 90° when open (250ms), the call in 13px mono (tool name bold, arguments muted) and an upstream-rust Label Strong count; hover fills it with tint, and its focus outline is drawn inset (-4px). Open, it reveals a result head ruled in ink above and stone rule below, then the JSON on stone in 13px mono, keys in ink 600 and punctuation muted, capped at 260px and scrolling. The panel's height animates over 350ms; both motions are off under reduced motion. The user's ask sits above it as a right-aligned tint block at 32ch.

### Team code tile, inline
The viewer's Team code tile reused inside running text: ink fill, paper text, 11px 800 at 0.06em with a 5px Team-colour leading band, set 6px after the Element name it belongs to. Lists of affected Elements are grouped by hop under a muted label and separated by faint middots.

### YAML file block
A source file shown in a 1.5px ink frame on paper. Its head is 12px 600 mono, the path on the left and a muted note on the right, ruled off in ink. Lines are 13px mono at 1.7 with a 48px right-aligned faint line-number column that cannot be selected; keys are 600, values muted, an elided run is shown as a spaced gap number, and the line the page points at carries the upstream wash across its full width. A muted 15px caption sits below a stone rule.

### Persona table
A full-width table at Landing Small: Label Strong muted heads over an ink rule, rows ruled in stone, the role muted (18%), the question at 17px 700 (38%), the viewer answer, and the MCP tool names as 13px mono links separated by faint middots. Under 720px each row becomes a stacked block, ruled in stone with an ink rule above the first, and each cell gains its column name as an inline muted prefix.

## Do's and Don'ts

### Do:
- **Do** reserve yellow (#ffc629) for you-are-here: the current scope tile, crumb arrows, current Deployment, selection, lens origin, and focus on reversed or ink fields.
- **Do** pair every Team colour with its reversed code tile, and draw it as the left edge of the node.
- **Do** set chrome in 13px and 11px only, and rank by weight, uppercase and reversal.
- **Do** frame surfaces with 1.5px ink and keep every chrome corner square.
- **Do** express state with zero-blur rings, fills or reversal.
- **Do** draw stepped-back marks as a fainter solid stroke at about 3:1 against the ground; never fade them, and never borrow a dash, because dashes carry meaning.
- **Do** match focus to its field: an ink outline on light fields, yellow only on reversed or ink fields.
- **Do** draw new pictograms on the 16-unit grid with a 1.75 stroke, square caps and mitred joins.
- **Do** ship fonts with the static site; never fetch them from a CDN.
- **Do** build landing sections from plate fields, stone ground and white panes in 1.5px frames, with square corners.
- **Do** set landing reading text in the landing ramp (17px body, 15px small, 20px lede and question, 30–46px headlines, 42–76px display) and keep the pictured viewer's chrome at 13px and 11px.
- **Do** keep landing focus outlines white on plate fields and ink on light fields.

### Don't:
- **Don't** use yellow as a brand accent, hover colour, warning or emphasis.
- **Don't** add drop shadows or blurred elevation of any kind.
- **Don't** round chrome corners; radius belongs to the Person, datastore node shapes only.
- **Don't** show a Team by colour alone.
- **Don't** introduce a third chrome type size or a second sans family.
- **Don't** recolour or redraw the Archidocs mark; use the files in `assets/brand/`. Brand indigo belongs to the keystone only, never to chrome.
- **Don't** fade dimmed elements below legibility.
- **Don't** dash an edge to step it back; dashes are reserved for External, open boxes, removed Relationships and sequence-chart Returns and lifelines.
- **Don't** use a yellow focus outline on a light field.
- **Don't** use yellow anywhere on the landing page outside the pictured viewer's you-are-here tile; not for crumb chevrons, focus, selection or emphasis.
- **Don't** bring the landing reading ramp into viewer chrome.
