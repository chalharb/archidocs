# Research: rendering sequence charts for Dynamic Views

Ticket: [04 – Rendering sequence charts for Dynamic Views](../issues/04-sequence-chart-rendering.md)
Date: 2026-11-21

## Question (from the ticket)

How can an interactive sequence chart (lifelines, ordered messages, sync and async arrows, nesting) be rendered in a React app without wrapping a diagram tool? Compare React Flow with fixed lifeline layout, custom SVG and React, and existing React sequence-diagram libraries. Cover how layout is computed, interactivity (clicking a step to jump to the Relationship), how it scales to about 50 steps, and whether one Dynamic View can switch between a sequence chart and a numbered-step graph.

## Short answer

Use React Flow, the viewer's existing canvas, and compute the layout yourself in a small, pure TypeScript function. Model each participant as a custom node that draws its own lifeline. Model each step as a custom edge between per-step handles placed at fixed row heights. Fragments (`alt`, `loop`, `par`, nested groups) become background nodes. LikeC4, the closest prior art, ships exactly this design in production. Its layouter places elements with the Cassowary constraint solver `@lume/kiwi`, and it can switch the same dynamic view between a "Diagram" graph and a "Sequence" chart. No maintained React sequence-diagram library fits: each one is a text-to-diagram tool, which the "not a wrapper" rule excludes, or has been abandoned. Fifty steps is small for React Flow. The real problems at that length are readability (actor headers scroll out of view), not rendering speed.

## Versions, licences, maintenance

| Package / project | Version checked | Licence | Maintenance | Role here |
|---|---|---|---|---|
| [`@xyflow/react`](https://github.com/xyflow/xyflow) (React Flow) | 13.0.2 ([released 2026-11-17](https://github.com/xyflow/xyflow/releases)); 13.0.0 was 2026-11-16; last v12 is 12.12.1 | MIT | Very active (repo pushed 2026-11-19) | Canvas: pan, zoom, selection, events |
| [`likec4/likec4`](https://github.com/likec4/likec4) | v1.61.0 (2026-11-14) | MIT | Very active; sequence variant since [v1.40.0 (2025-09-14)](https://github.com/likec4/likec4/blob/main/CHANGELOG.md) | Prior art (design reference only, not a dependency) |
| [`@lume/kiwi`](https://github.com/lume/kiwi) | 0.4.4 (npm, last published 2024-09-17) | BSD-3-Clause (npm metadata) | Slow but stable (repo pushed 2025-06); LikeC4 depends on it today | Optional constraint solver for layout |
| [`mermaid`](https://github.com/mermaid-js/mermaid) | 12.3.0 | MIT | Very active | Algorithm reference only |
| [`plantuml/plantuml`](https://github.com/plantuml/plantuml) | master | LGPL-3.0 per GitHub (PlantUML is multi-licensed) | Active | Algorithm reference only (Java) |
| [`@zenuml/core`](https://github.com/mermaid-js/zenuml-core) | 4.13.2 | MIT | Active | Excluded: renders a text DSL, so using it means wrapping a diagram tool |
| [`react-sequence-diagram`](https://github.com/zfanta/react-sequence-diagram) | 0.0.12 (code from 2018) | BSD-2-Clause | Abandoned; wraps [js-sequence-diagrams](https://github.com/bramp/js-sequence-diagrams) (last push 2022) and uses Raphael/Snap.svg | Excluded |
| `react-sd` | 1.0.2 (2020) | MIT | Abandoned, no repository link on npm | Excluded |
| [`@joint/core`](https://github.com/clientIO/joint), Syncfusion diagram | 4.3.4 / 35.x | MPL-2.0 / commercial | Active | Excluded: general diagramming frameworks that duplicate React Flow ([JointJS sequence demo](https://www.jointjs.com/demos/sequence-diagram)) |

## How the prior art renders Dynamic Views

### LikeC4: React Flow plus a constraint-solved layout (the closest match)

- **Two display variants of one view.** A dynamic view renders as a `diagram` by default and as a sequence chart with `variant sequence` ([LikeC4 docs: dynamic views](https://likec4.dev/dsl/views/dynamic/)). The viewer also has a "Diagram | Sequence" segmented control that calls `diagram.switchDynamicViewVariant(variant)` at runtime ([`DynamicViewModeSwitcher.tsx`](https://github.com/likec4/likec4/blob/main/packages/diagram/src/navigationpanel/walkthrough/DynamicViewModeSwitcher.tsx)). This answers the ticket's switching question: one Dynamic View can be shown either way.
- **Layout is a separate pure step.** `calcSequenceLayout(view)` in [`packages/layouts/src/sequence/sequence-view.ts`](https://github.com/likec4/likec4/blob/main/packages/layouts/src/sequence/sequence-view.ts) works in three stages:
  1. Each Element at either end of a step becomes an actor (a column), in declaration order. LikeC4 does not sort columns automatically; authors set the order with `include` ([docs](https://likec4.dev/dsl/views/dynamic/)).
  2. Each step gets a `row`. A step that continues from the previous step's target (A→B, then B→C) stays on the same row with a horizontal `offset`. A self-call takes two rows. A step that goes leftwards is marked `isBack`, and its ports switch to the actor's left side.
  3. Each step gets a source port and a target port on its actors at `row` heights. A `SequenceViewLayouter` then solves for actor x positions, row heights, compound boxes and fragment boxes.
- **The solver is Cassowary.** [`layouter.ts`](https://github.com/likec4/likec4/blob/main/packages/layouts/src/sequence/layouter.ts) uses `kiwi.Solver` with variables for each actor's x, each row's height and top, and each subflow's box, under `required`, `strong` and `soft` strengths. Its constants ([`const.ts`](https://github.com/likec4/likec4/blob/main/packages/layouts/src/sequence/const.ts)) are `ACTOR_GAP = 80`, `MIN_ROW_HEIGHT = 100`, `PORT_HEIGHT = 24` and `CONTINUOUS_OFFSET = 22`. Label widths feed the gap constraints, so a long label on a step that spans several columns pushes those columns apart.
- **Mapping to React Flow.** [`sequence-view-to-xy.ts`](https://github.com/likec4/likec4/blob/main/packages/diagram/src/likec4diagram/xyflow-sequence/sequence-view-to-xy.ts) emits:
  - `seq-actor` nodes. These are not draggable. Each one gets `viewHeight` and its list of ports.
  - `seq-step` edges, using `sourceHandle: <stepId>_source` and `targetHandle: <stepId>_target`. Each edge also carries `stepnum`.
  - `view-group` nodes for compounds (parent Elements drawn as boxes behind actors). These have `pointerEvents: 'none'`.
  - `seq-parallel` and `seq-subflow` nodes for fragments.

  Z-order is fixed: compound 1, subflows 10, actor 50, step 100.
- **Lifeline in the node.** [`SequenceActorNode.tsx`](https://github.com/likec4/likec4/blob/main/packages/diagram/src/likec4diagram/custom/nodes/SequenceActorNode.tsx) draws the lifeline as an absolutely positioned bar of height `viewHeight - positionAbsoluteY`, which overflows the node box. It renders one invisible React Flow `<Handle id=… type=… position=…>` per port at the computed `cy`, plus a small activation bar.
- **Step edge.** [`SequenceStepEdge.tsx`](https://github.com/likec4/likec4/blob/main/packages/diagram/src/likec4diagram/custom/edges/SequenceStepEdge.tsx) draws a straight line with `getSmoothStepPath`, using `offset: 30` for self-loops, and places the label beside the source. Arrowheads and line style (solid, dashed or dotted, for sync, async or return) come from the edge's `head`, `tail` and `line` properties.
- **Interactivity and long charts.**
  - Each diagram edge carries `relations: RelationId[]` back to the Model ([`view-computed.ts`](https://github.com/likec4/likec4/blob/main/packages/core/src/types/view-computed.ts)), and a step can `navigateTo` another view.
  - Clicking a step starts a walkthrough ([v1.42.0 changelog](https://github.com/likec4/likec4/blob/main/CHANGELOG.md)).
  - v1.59.0 added nested `alt`/`loop`/`opt`/`try` frames and actor headers that stay visible while panning ([`FloatingSequenceActors.tsx`](https://github.com/likec4/likec4/blob/main/packages/diagram/src/likec4diagram/ui/FloatingSequenceActors.tsx), fixing [#3074](https://github.com/likec4/likec4/issues/3074)). It also added a docked outline panel with clickable, numbered steps ([diagram CHANGELOG](https://github.com/likec4/likec4/blob/main/packages/diagram/CHANGELOG.md)).
  - Collapsed subflows are laid out again on the client, in the browser.
- **Known limits.** The sequence variant only supports steps between leaf Elements ([docs](https://likec4.dev/dsl/views/dynamic/); [`sequence-view.ts`](https://github.com/likec4/likec4/blob/main/packages/layouts/src/sequence/sequence-view.ts) logs "Sequence view does not support nested actors"). Image export was missing when the feature launched ([v1.40.0 notes](https://github.com/likec4/likec4/blob/main/CHANGELOG.md)).

### Structurizr: no sequence renderer

- The Structurizr UI draws dynamic views only as collaboration diagrams. The maintainer said "There's no built-in sequence diagram renderer" ([structurizr/ui discussion #111, 2025-08-01](https://github.com/structurizr/ui/discussions/111)).
- Sequence output comes from exporters. Setting `plantuml.sequenceDiagram=true` emits a UML sequence diagram for a dynamic view; the default is `false`, which emits a collaboration diagram ([Structurizr PlantUML export](https://docs.structurizr.com/export/plantuml)). The [Mermaid exporter](https://docs.structurizr.com/export/mermaid) has the same option.
- Lesson for Archidocs: a Dynamic View should be ordered Relationship instances with no layout of its own. That is already the map's rule ("Views are queries over the Model").

### Mermaid: a one-pass cursor (algorithm reference)

[`sequenceRenderer.ts`](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/sequence/sequenceRenderer.ts) works in two steps:

- **Horizontal.** `getMaxMessageWidthPerActor` measures every message label. `calculateActorMargins` then sets each actor's margin to `max(actorMargin, labelWidth + actorMargin − w₁/2 − w₂/2)`. This only counts messages between neighbouring actors (`msg.from === actor.nextActor` / `prevActor`). Self-messages are split half on each side, and notes are handled separately.
- **Vertical.** A single global `bounds` object keeps a `verticalPos` cursor. Each message calls `bumpVerticalPos(...)` by its label height plus margins. Fragments push onto a loop stack with `newLoop` and pop with `endLoop`, which closes the box at the current cursor.

This is easy to copy, but the neighbour-only width rule lets a long label on a step that spans several columns overlap the lifelines in between. A constraint formulation avoids that.

### PlantUML Teoz: one-dimensional constraint relaxation (algorithm reference)

The newer "Teoz" sequence engine places participants (`LivingSpace`) on a `RealLine` of `Real` values that support `addFixed`, `addAtLeast` and `ensureBiggerThan`. `RealLine.compile()` re-applies "positive forces" until nothing moves ([`Real.java`](https://github.com/plantuml/plantuml/blob/master/src/main/java/net/sourceforge/plantuml/real/Real.java), [`RealLine.java`](https://github.com/plantuml/plantuml/blob/master/src/main/java/net/sourceforge/plantuml/real/RealLine.java)). In effect it is a hand-written solver for "x_j ≥ x_i + d" constraints only. It confirms the same model as LikeC4, and it suggests a general Cassowary solver is optional when all constraints are lower bounds.

## Option comparison

### A. React Flow, fixed lifeline layout (LikeC4 design)

- **Layout.**
  - Columns come from the Dynamic View's participant order.
  - Rows come from step order, with continuation and self-call rules.
  - x positions come from minimum-gap constraints:
    - `x[c+1] ≥ x[c] + w[c]/2 + w[c+1]/2 + ACTOR_GAP`;
    - for each step from column i to column j, `x[j] − x[i] ≥ labelWidth + pad`.
  - y positions come from cumulative row heights, using `max(MIN_ROW_HEIGHT, label height)` plus fragment headers and padding.

  All constraints are lower bounds, so a longest-path pass over columns in order solves them exactly with no dependency (the PlantUML Teoz approach). `@lume/kiwi` is worth adding only if soft goals are wanted, such as "keep gaps equal" (the LikeC4 approach).
- **Rendering.**
  - A custom `participant` node draws its header and a lifeline down to the view's height, and renders one hidden `<Handle id>` per port. Handles can be placed anywhere with CSS, and edges pick one by `sourceHandle`/`targetHandle` ([React Flow: Handles](https://reactflow.dev/learn/customization/handles)).
  - A custom `step` edge builds its own SVG path from `sourceX/Y` and `targetX/Y` ([React Flow: custom edges](https://reactflow.dev/learn/customization/custom-edges)): a straight line, or a three-segment path for self-calls.
  - Sync, async and return arrows are SVG markers plus `strokeDasharray`.
  - Fragments are background nodes with `pointerEvents: none` and a low `zIndex`.
- **Interactivity.**
  - `onEdgeClick` and `onNodeClick` are built in ([`<ReactFlow>` API](https://reactflow.dev/api-reference/react-flow)). Put `relationshipId` and `stepIndex` in `edge.data`; a click selects the step and offers "Show in C2/C3" for that Relationship.
  - `edgesFocusable` gives Tab/Enter keyboard stepping, and `ariaLabelConfig` gives accessible labels.
  - Turn off `nodesDraggable` and `nodesConnectable` (Layout is out of scope).
  - The viewer gets the same pan, zoom, `fitView`, minimap and theme as the C1–C3 and Deployment Views.
- **Scale.** Fifty steps across about 10 participants is about 50 edges and about 10–25 nodes, well under the map's ~150-node limit. React Flow's own [performance guide](https://reactflow.dev/learn/advanced-use/performance) says re-renders are the main cost: v13 is built with the React Compiler, and the guide recommends memoised custom nodes and edges and narrow store selectors. `onlyRenderVisibleElements` is available for very tall charts ([API](https://reactflow.dev/api-reference/react-flow)).

  The real problem is readability. Fifty rows at about 100px is about 5,000px tall, so fitting the whole chart on screen makes it unreadable. The viewer needs vertical `panOnScroll`, a `translateExtent` limit, and actor headers that stay in view. LikeC4 had to add these headers after a user reported the problem ([#3074](https://github.com/likec4/likec4/issues/3074)).
- **Costs and risks.**
  - Lifelines drawn outside the node box are not counted in React Flow's own bounds, so give `fitView`/`fitBounds` your own bounds (LikeC4 has `utils/view-bounds.ts` for this).
  - React Flow 13 is five days old: it requires React 18 or later and renames several store hooks ([v13.0.0 release notes](https://github.com/xyflow/xyflow/releases)). LikeC4 still pins 12.12.1.
  - Static SVG export needs its own path (LikeC4 shipped without it at first).

### B. Custom SVG with React (no canvas library)

- **Layout.** Same layout function as option A.
- **Rendering.** One `<svg>` of `<line>`, `<path>` and `<text>` elements. This is the simplest code, and the output doubles as a static SVG export.
- **Interactivity.** All of it has to be rebuilt: pan and zoom (for example d3-zoom), fit-to-view, selection, keyboard focus, minimap, and position-sticky headers. Clicking a step is just an `onClick`.
- **Scale.** Fifty steps is trivial to render.
- **Verdict.** It works, but the viewer would then have two interaction models: React Flow for structural Views and hand-written SVG for Dynamic Views. It also makes the planned "switch to a numbered-step graph" harder, because that graph needs React Flow anyway. It is still the best route for a headless SVG export (CLI or PR previews), using the same layout output.

### C. Existing React sequence-diagram libraries

- `react-sequence-diagram` (2018, wraps js-sequence-diagrams and Raphael) and `react-sd` (2020) are abandoned.
- [`@zenuml/core`](https://github.com/mermaid-js/zenuml-core) is maintained and uses React internally, but it takes a text DSL and renders the whole diagram itself. Using it means generating DSL text from the Model and giving up control of interaction, which breaks the "not a wrapper" rule.
- Mermaid has the same problem.
- JointJS and Syncfusion offer sequence demos, but they are full diagramming frameworks that would compete with React Flow.
- **Verdict.** None is a fit.

## Switching between a sequence chart and a numbered-step graph

Yes. Use one Dynamic View with two Layouts:

- **Sequence.** The layout function above.
- **Graph.** The structural auto-layout engine from [ticket 02](../issues/02-auto-layout-engines.md), run over the same participants. Each step becomes its own edge labelled with its step number (as in LikeC4's `diagram` variant and Structurizr's collaboration diagrams).

Both produce React Flow nodes and edges keyed by the same step ids and Element ids. The toggle then keeps the selected step and walkthrough position, as LikeC4's `switchDynamicViewVariant` does ([source](https://github.com/likec4/likec4/blob/main/packages/diagram/src/navigationpanel/walkthrough/DynamicViewModeSwitcher.tsx)). The Model stays untouched, because the display mode is viewer state with at most a default stored on the View.

Two constraints carry over from LikeC4:

- Sequence participants must be the Elements at the chosen C-level. A Service and its own Component cannot both be lifelines, though parents can be drawn as boxes behind their children.
- Column order should come from the View, with first appearance as the default.

## Recommendation

**Approach.** Render Dynamic Views as sequence charts with **React Flow and a dedicated pure-TypeScript sequence layout function**, following LikeC4's design but written from scratch. Do not depend on LikeC4.

- **Layout input and output.** The input is the ordered steps, each with a `relationshipId` and a sync, async or return kind. The output is participant x and width, row y, per-step port coordinates, and fragment boxes.
- **Solving.** Start with a longest-path pass over lower-bound constraints (no dependency). Add `@lume/kiwi` (BSD-3-Clause, used by LikeC4) only if soft goals turn out to matter.
- **Canvas.** Participants are custom nodes that draw their own lifelines and per-step handles. Steps are custom edges carrying `relationshipId`. Fragments and parent Elements are background nodes. Dragging and connecting are off.
- **Arrows.** Sync is a solid line with a closed head, async a solid line with an open head, and return a dashed line.
- **Graph mode.** The numbered-step graph is a second Layout of the same View in the same canvas, with a toggle that keeps the selection.
- **Export.** Keep a plain-SVG renderer of the same layout output in mind for static export, but leave it out of v1.

**What the follow-up prototype ([ticket 13](../issues/13-sequence-chart-prototype.md)) should test:**

1. **Layout correctness** on the checkout scenario (about 15 steps), plus a stress case of about 50 steps and about 10 participants. Include long labels on steps that span several columns, back-and-forth steps, self-calls, A→B→C continuations, and one nested `alt` inside a `loop`. Check that nothing overlaps.
2. **Performance.** Layout time and first render for 50 steps, and frame rate while panning. Pin either React Flow 13.0.x or 12.12.x, and note which.
3. **Readability at 50 steps.** Vertical scroll-panning, actor headers that stay in view, step numbers, and a side outline (list of steps) synced with the canvas.
4. **Step interaction.** Click or keyboard-select a step to highlight it and its two participants. Then "show this Relationship" opens the matching C2/C3 View with that Relationship selected and fitted to screen. Also test previous and next step.
5. **Arrow semantics.** Do the sync, async and return styles read clearly in both light and dark themes?
6. **Mode toggle.** Switch Sequence and numbered-step Graph on the same View, using the ticket 02 engine for the graph, and check that the selected step survives the switch.
7. **Fit and bounds.** `fitView` must include the full lifelines, using custom bounds.
8. **Leaf-only participants.** Decide what to do when a Dynamic View mixes C-levels (reject in `archidocs check`, or collapse to one level).
