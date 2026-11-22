# Viewer UX

Type: prototype
Status: resolved
Assignee: Logan Harber
Blocked by: 05, 09, 10
Map: [Archidocs v1](../map.md)
Context: [View kinds and definitions](10-view-definitions.md) fixes the Generated View scopes and ids, what each kind shows, collapsed neighbours, and Deployment View edges; expand and collapse is this ticket's. [ADR format and linking](11-adr-format.md) puts each ADR's full body, status, effective status and links in the Bundle; an Element's ADR timeline covers ADRs linking it or its descendants, newest first, with superseded ones marked.
Context: [Sequence chart prototype](13-sequence-chart-prototype.md) fixes the Dynamic View screen (Step outline with a play transport, chart, and a detail panel that links each Step's Relationship to its Generated Views); its other defaults are this ticket's to keep or change.
Context: [Auto-layout engine prototype](09-auto-layout-prototype.md) fixes the engine (elkjs, each container laid out on its own, edges bundled at container borders), the `TB | BT | LR | RL` direction with a viewer toggle, and Deployment Views grouped by System inside each Target; when to switch off animated transitions for large Views is this ticket's.

## Question

How does each persona answer their question in the viewer? Prototype the main flows: focus on an Element, expand and collapse Systems, switch between C1, C2 and C3, a Deployment View with an Environment picker, highlighting Upstream and Downstream impact, a Team ownership filter, and an Element panel showing URLs and ADRs.

## Answer

Settled with the user on 2026-11-22 after four prototype variants. Terms follow [GLOSSARY.md](../../../GLOSSARY.md).

**Chosen design: variant D, "Explorer, focused".** The user started from three shells: A Explorer (tree, View tabs, Element panel), B Lens canvas (one canvas, an ask bar, a floating card) and C Element pages (search-first pages with a diagram panel). They picked A, but said it was easy to lose your place, showed too much at once, and made exporting sub-sections hard. D is A reworked for those three problems. B and C were not taken.

**Shell**
- **Rail** on the left: Find (`/`), Model, Teams and Views open as a flyout over the canvas, then close on a pick.
- **Location bar** on top (see "Where am I").
- **Canvas** in the middle.
- **Element panel** on the right, shown only while something is selected. Tabs: Overview (description, technology, persona actions), URLs (per Environment and Deployment Target, with copy and named endpoints), ADRs (the timeline from [ADR format and linking](11-adr-format.md), opening in a reader) and Links (Relationships, Downstream and Upstream).

**Where am I**
- **The URL holds the whole screen:** View, open boxes, lens, selection, picked nodes and direction.
  - A change of View, lens or open boxes is pushed to browser history; selection and picks replace the current entry.
  - Back and forward, a **Recent** list (last 10 places) and **Copy link** all reopen the exact screen.
- **Breadcrumbs** walk up the scope ladder: C1 › C2 Landscape › System › Service (C3). A Saved View shows as Saved › Project › title. Links next to them jump to each Environment's Deployment View.
- **Chips** show what is active: open boxes (✕ collapses all), the lens with its summary (✕ clears it) and the picked count.

**Trees in the rail.** Both are collapsible hierarchies, not flat lists, with a **By kind / By Team** toggle. The current scope is tinted and its branch opens.
- **Model:** People, Systems and External Systems groups; Systems › Services › Components. Each row has a kind glyph, a child count and the Team code. By Team lists what each Team owns; an Element owned by another Team than its parent shows under its own Team.
- **Views:** Landscapes (C1, C2) › Systems (each System's C2 View, with the C3 Views of its Services nested under it) › Deployment (one per Environment) › Saved Views grouped by Project, tagged structural or Dynamic. By Team shows a Workspace group (Landscapes and Deployment Views, which no Team owns), then each Team's C2, C3 and Saved Views.

**Persona questions are lenses** over whatever View is showing. Element-level results map onto the View: a collapsed box is marked when anything inside it is hit, with the nearest distance.
- **Impact** (Product Owner): upstream, both or downstream, with a distance badge on each node. An edge lights only when it steps one hop closer to the origin. Everything else dims.
- **Connect to…** (Enterprise Architect): pick a start node, then click or find the end node. Paths light up, *Shortest* or *All ≤ 4 hops*, and every node on them is picked for export.
- **Team** (Developer): from the Teams list or an Owner chip. Owned nodes are ringed; a box that only contains owned Elements is marked as such.
- **Where is it deployed?** (Solutions Architect): opens the Environment's Deployment View with that Service's Deployments marked.
- **URL in an Environment** (QA Tester): the URLs tab; Find also matches URLs.
- **ADRs** (Technical resource): the ADRs tab.

**Navigation on the canvas**
- **Expand and collapse** is viewer state per View: `+`/`−` on a System or a Service with Components. Saved Views don't expand; their shape is their definition.
- **Double-click** a box to open its own Generated View: C3 if it has Components, else its System's C2.
- **Focus** (from Find, a tree or a link) stays in the current View when it can, opening the Element's System in the C2 Landscape; otherwise it opens that Generated View.
- **Selecting** a node fades the edges that don't touch it and labels its own edges with their technology.

**Export and Saved Views**
- **Shift-click** picks nodes; *Connect to…* picks a path.
- **Export** gives the whole View or the picked nodes as SVG or PNG. Picked nodes are laid out again on their own, with their open containers, the edges among them, a title, the commit and a key.
- **Save as View** turns the screen into Saved View YAML for [View kinds and definitions](10-view-definitions.md) and shows the `upsert_view` call:
  - picks become ids;
  - an open box becomes `{element, with: [children]}`;
  - an impact lens becomes `{element, upstream/downstream}`;
  - a Team lens becomes `{team}`.

**Defaults this ticket owns**
- **Animated transitions** are on up to 100 nodes and off above, and always off with `prefers-reduced-motion`. This closes the question left by [Auto-layout engine prototype](09-auto-layout-prototype.md).
- **Node placement:** `BRANDES_KOEPF`. `NETWORK_SIMPLEX` took about 2.4 s on the prod Deployment View (about 220 boxes with containers); Brandes-Köpf took about 430 ms, and C2 at 154 nodes about 125 ms.
- **Team colour:** a generated OKLCH palette (golden-angle hues), shown as a stripe on the node and always paired with the Team code.
- **Zoom:** below 45%, sub-labels and Team codes hide.
- **Direction:** a toggle in the location bar, per View.

**Handed on**
- Gaps the export and Save as View flows exposed in [View kinds and definitions](10-view-definitions.md), plus how Views are rendered outside the browser, go to [Saved View export and selectors](18-saved-view-export.md):
  - a Saved View can't keep some Systems open and others collapsed;
  - there is no "all hops" value for `upstream`/`downstream`;
  - there is no path selector;
  - exports drop lens highlighting;
  - CI has no render command.
- Search and the Element panel's content, which the map had as fog ("Search and Element pages"), are settled here: Find matches name, id, Team, technology and URL, and the panel is described above. Separate Element pages (variant C) were not chosen.

**Not settled here**
- The Dynamic View screen stays as [Sequence chart prototype](13-sequence-chart-prototype.md) settled it; the prototype only stubbed it in the Views tree.
- Box-select (drag) for picking wasn't built; picks are shift-click or a path.
- Speed on a real Workspace: the sample is synthetic, as in [Auto-layout engine prototype](09-auto-layout-prototype.md).

Prototype: branch `prototype/14-viewer-ux`, folder `.scratch/archidocs-v1/prototypes/14-viewer-ux/` ([README](../prototypes/14-viewer-ux/README.md) on that branch). Run it with `pnpm install && pnpm dev`, then `?variant=D` (A–C are the rejected shells).
