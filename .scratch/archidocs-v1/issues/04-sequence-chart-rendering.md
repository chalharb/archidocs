# Rendering sequence charts for Dynamic Views

Type: research
Status: resolved
Blocked by: –
Map: [Archidocs v1](../map.md)

## Question

How can an interactive sequence chart (lifelines, ordered messages, sync and async arrows, nesting) be rendered in a React app without wrapping a diagram tool? Compare React Flow with fixed lifeline layout, custom SVG and React, and existing React sequence-diagram libraries. Cover: how layout is computed, interactivity (clicking a step to jump to the Relationship), how it scales to about 50 steps, and whether one Dynamic View can switch between a sequence chart and a numbered-step graph.

## Answer

Render Dynamic Views with **React Flow and a small layout function we write ourselves** (pure TypeScript; add the `@lume/kiwi` constraint solver only if needed). No React sequence-diagram library fits: the maintained ones would mean wrapping Mermaid or ZenUML. Custom SVG would mean rebuilding pan, zoom and selection as a second interaction model.

- **How it works:** each participant is a custom node that draws its own lifeline. Each step is an edge between handles at fixed row heights. Clicking a step uses `onEdgeClick` with the Relationship id stored on the edge. LikeC4 uses the same approach, and also lets one View switch between a diagram and a sequence chart.
- **At 50 steps:** about 50 edges and 25 nodes, which is small for React Flow. The hard part is how tall the chart gets: it needs vertical scrolling, participant headers that stay visible, and a step outline.
- **Numbered-step graph:** a second layout of the same View, laid out by the engine from [Auto-layout engines for React Flow](02-auto-layout-engines.md).
- **Version:** React Flow 13 came out on 2026-11-16, so pin 13.0.x or 12.12.x.

Findings: [research/04-sequence-chart-rendering.md](../research/04-sequence-chart-rendering.md)
