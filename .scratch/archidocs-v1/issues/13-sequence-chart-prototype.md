# Sequence chart prototype

Type: prototype
Status: resolved
Assignee: Logan Harber
Blocked by: 04, 10
Map: [Archidocs v1](../map.md)
Context: [View kinds and definitions](10-view-definitions.md) fixes the Step shape (`from`/`to`, return Steps, notes, flat list, interaction from the Relationship) and Dynamic View ids for linking.

## Question

How should a Dynamic View look and behave as a sequence chart? Prototype one using the approach chosen in research, with a realistic checkout scenario (about 15 steps, sync and async). React to the visual style, the step interaction, and how it links back to the structural Views.

## Answer

Settled with the user on 2026-11-22 after they used the prototype. Terms follow [GLOSSARY.md](../../../GLOSSARY.md).

**Chosen design: variant D, "outline with transport + detail".** The user started from three variants (A explorer, B walkthrough, C linked context), asked for A and B combined, then picked D over E:
- **Left:** a play transport (first, previous, play/pause, next, "Step n of N", and a progress bar with one clickable tick per Step), with the numbered Step outline under it. Each outline row shows the description and `from → to` with the Step's arrow style.
- **Middle:** the sequence chart.
- **Right:** the selected Step's detail. That covers its Relationship (id, description, interaction, technology, `via`/`channel`, Owner), buttons that open the Generated Views containing that Relationship, and the other Dynamic Views that use it. With nothing selected, the panel shows the View summary, its participants and the legend.
- **Playback:** advances about every 1.4 s. The camera centres each Step and later Steps fade, but only while playing; when paused, the chart only scrolls the selected Step into view. Space plays or pauses, J/K (↓/↑) step through, Esc clears.
- **Selection** is shared by the outline, the chart, the progress bar and the detail panel.

**Linking back to structural Views.** A Step links to the Generated Views that contain its Relationship, most specific first:
- `c3/<service>` when both ends are Components of one Service;
- the consumer's `c2/<system>`, then the provider's `c2/<system>`;
- `c2`;
- `c1` when the ends are in different Systems.

The viewer URL carries the Relationship to select and fit. Users saw this as buttons and liked it; variant C's inline structural panel wasn't chosen.

**Carried over from the prototype without separate discussion** (defaults for [Viewer UX](14-viewer-ux.md) to keep or change):
- **Rendering:** React Flow, with participant nodes that draw their own lifeline and activation bars and one custom edge per Step. Layout is a pure function: one row per Step, columns in participant order, and x positions from lower-bound gaps solved in one longest-path pass, so no constraint solver is needed. It took about 4 ms for 46 Steps across 17 participants.
- **Arrows:** sync is a solid line with a filled head; async is solid with an open head; return is dashed with an open head. Every Step has a numbered badge, and each label sits next to the sending lifeline.
- **Activation bars:** a sync call opens one and its return closes it.
- **Headers** stay pinned once the chart scrolls. The zoom never drops below 85%, so wide charts pan sideways. A "Fit whole chart" control uses bounds we compute ourselves, because lifelines overflow the node box.
- **Sequence | Graph toggle:** the Graph is a numbered-Step graph laid out by elk, with returns folded onto their call. It keeps the selection.
- **Versions:** React Flow 12.12.1 and elkjs 0.12.1.

**Not settled here:**
- **Event Steps.** [Core domain model](05-core-domain-model.md) stores a subscription as subscriber → publisher, but the event travels publisher → subscriber. The prototype resolved a Step drawn publisher → subscriber to the subscriber's `via` Relationship as a new "event" kind. It also showed the broker either as a direct arrow or as two legs through its lifeline. Handed to [Event Steps in Dynamic Views](17-event-steps.md).
- Frame rate while panning wasn't measured, and the prototype couldn't test static SVG export.

Prototype: branch `prototype/13-sequence-chart`, folder `.scratch/archidocs-v1/prototypes/13-sequence-chart/` ([README](../prototypes/13-sequence-chart/README.md) on that branch). Run it with `pnpm install && pnpm dev`, then pick a variant with `?variant=A…E`.
