# 20: Dynamic View screen

Status: ready-for-agent
Blocked by: 14, 19
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

People walk through a scenario in the viewer and export it as a sequence chart.

- Sequence layout as a pure function: one row per Step, columns in participant order, and x positions from one longest-path pass over lower-bound gaps. It is shared with the renderer.
- Left: the play transport (first, previous, play/pause, next, "Step n of N", a progress bar with ticks) and the numbered outline. Playback advances about every 1.4 s.
- Middle: the chart.
  - Participant nodes draw their own lifelines and activation bars.
  - Arrows: sync is solid with a filled head; async is solid with an open head; return is dashed.
  - Numbered badges, headers pinned, zoom never below 85%, and a Fit control.
- Right: the Step detail, with buttons to the Generated Views containing its Relationship (most specific first, plus the broker's `c2/<system>`) and the other Dynamic Views that use it. With nothing selected, it shows the summary and legend.
- Toggles: "Show brokers", which splits event Steps into `na`/`nb` legs, and Sequence | Graph.
- Keys: Space, J/K and Esc.
- `archidocs export` draws Dynamic Views as sequence charts.

## Acceptance criteria

- [ ] Layout unit tests on a 46-Step fixture.
- [ ] Playwright covers playback, keyboard, shared selection, broker legs and the View-link buttons.
- [ ] A golden SVG of a sequence chart.
