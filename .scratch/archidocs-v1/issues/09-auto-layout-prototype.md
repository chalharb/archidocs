# Auto-layout engine prototype

Type: prototype
Status: resolved
Assignee: Logan Harber
Blocked by: 02
Map: [Archidocs v1](../map.md)
Context: [Auto-layout engines for React Flow](02-auto-layout-engines.md): its research file lists the elkjs options and checks to test, including layout stability

## Question

Does the engine chosen in research hold up on real graphs? Prototype it in React Flow on a sample C2 graph (about 150 nodes), a C1 graph and a nested Deployment View. Check each against the auto-layout definition, measure layout time, and check stability when one Element is added.

## Answer

Settled on 2026-11-22 by reacting to a prototype that laid out a sample Workspace (18 Systems, 126 Services, prod Deployments in two regions) with four elkjs variants: [prototypes/09-auto-layout](../prototypes/09-auto-layout/README.md).

**Engine**
- **elkjs 0.12.1, `layered`, `ORTHOGONAL`, in its web worker,** with children and edges sorted by id.
- **Each container is laid out on its own** (`hierarchyHandling: SEPARATE_CHILDREN`, the prototype's variant D). Every edge that leaves a container is cut at a port on the container's border, one port per (container, direction, destination branch), so edges between Systems bundle at System borders.
- Why: one global pass (`INCLUDE_CHILDREN`, the research default) rearranged the inside of nearly every System when one Service was added (84–96% of nodes moved within their System). With D, an untouched System keeps its inside: 19% moved in C2 (13% for one added Relationship, 9–13% at 225 nodes). Systems still slide as whole blocks. D also had the fewest C2 crossings (303 against 349–397).
- **Rules:** every variant met the auto-layout definition on every graph: no overlaps, no edges through nodes, no diagonal segments, no detached edges. React Flow's rendered geometry matched ELK's exactly, using fixed sizes per node kind.
- **Time (browser worker round-trip, median):** C2 at 154 nodes about 90 ms; 225 nodes about 125 ms; C1 about 33 ms; grouped Deployment View about 260–350 ms.
- **Not usable:** ELK's model-order options (`considerModelOrder`, `forceNodeModelOrder`, `cycleBreaking MODEL_ORDER`) throw on nested graphs in 0.12.1. `NETWORK_SIMPLEX` node placement took about 470 ms on the flat Deployment View, against about 150 ms for `BRANDES_KOEPF`; the engine's node-placement choice is an implementation detail to tune against that budget.

**Direction**
- A View is drawn top to bottom, bottom to top, left to right or right to left (`TB | BT | LR | RL`, ELK's `DOWN | UP | RIGHT | LEFT`). All four worked with every variant.
- Defaults: LR for C1 and C2 Views, TB for Deployment Views.
- A Saved View may set `direction:`. The viewer has a direction toggle. No "auto" in v1.

**Deployment Views group by System**
- Inside each Deployment Target, a System box holds that System's Deployments in that Target. It's drawing only: not a Deployment Target, and not in the Model. A System that runs in two Targets appears in both.
- In the prototype this halved crossings (1,258 to 529) and kept an edit's movement inside its box (9%). Flat, one cluster held about 100 loose Deployments.
- This amends [View kinds and definitions](10-view-definitions.md).

**Transitions**
- Nodes animate to their new place when a layout changes (expand, collapse, another commit), so the eye can follow them.
- The user's machine crashed while showing the animated Deployment View in the Claude browser pane, with an 8.5 GB VM running on 16 GB. Headless layouts stayed under 1 s and about 300 MB, so the cause wasn't reproduced. When to switch animation off for large Views is left to [Viewer UX](14-viewer-ux.md).

**Not decided here**
- Real-Workspace measurements: the sample Workspace was invented. The engine choice should be rechecked when the first real Workspace exists.

The prototype is committed on the throwaway branch `prototype/09-auto-layout` (never merged), under `.scratch/archidocs-v1/prototypes/09-auto-layout/`.

