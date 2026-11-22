# Research: auto-layout engines for React Flow

Research for [issue 02](../issues/02-auto-layout-engines.md). Sources were read on 2026-11-21. Version and maintenance facts come from the npm registry and GitHub API on that date. Numbers marked **(measured)** come from a small benchmark run for this ticket (method in [Benchmark method](#benchmark-method)). They are indicative only, not a substitute for the [prototype ticket](../issues/09-auto-layout-prototype.md).

## Question (from the ticket)

Which layout engine (ELK.js layered with orthogonal routing, dagre, libavoid-js, or a combination) best meets the map's auto-layout definition inside React Flow? Cover: nested compound nodes (Systems around Services, Environments and Deployment Targets around Deployments), edge routing that avoids nodes, port placement, performance at about 150 nodes, running in a web worker, and how stable the layout stays across small Model changes.

The auto-layout definition being tested ([map](../map.md)): nodes never overlap, edges never pass through nodes, edges use right-angle routing, crossings are kept to a minimum (not zero). Scale: about 150 nodes per View, with expand and collapse.

## Short answer

- **Use elkjs alone, with the `layered` algorithm, `hierarchyHandling: INCLUDE_CHILDREN` and `edgeRouting: ORTHOGONAL`.** It is the only candidate that does all four parts of the auto-layout definition in one pass. It places nodes, sizes containers, minimises crossings and returns right-angle edge routes, including edges that cross container boundaries. On two 150-node test graphs (2-level and 3-level nesting) it produced 0 overlaps, 0 edges through nodes and 0 non-orthogonal edges, in about 90–115 ms per layout **(measured)**.
- **dagre fails two of the four rules on its own.** It handles compound nodes, but it returns polyline (diagonal) edges, and 35 of 260 and 89 of 200 edges passed through other nodes in the same tests **(measured)**. React Flow's own docs list dagre as having no edge routing ([layouting overview](https://reactflow.dev/learn/layouting/layouting)).
- **libavoid-js routes edges only; it does not place nodes.** It can turn dagre's output into a valid layout (0 through-node edges, all orthogonal). Its run time swung from about 30 ms to over 30 s depending on routing options and node gaps **(measured)**. It is LGPL, a 0.5 beta, and maintained by one person in their free time. Keep it as a fallback, not the main path.
- **Stability is ELK's weak spot.** Layout is deterministic for identical input, but adding one Relationship moved about 90% of the Services in the C2 test graph by a median of 130 px **(measured)**. ELK's "interactive" strategies, which would keep earlier positions, throw an error with `INCLUDE_CHILDREN`. Stability has to come from canonical input ordering and animated transitions. The prototype must measure this on real graphs.

## Versions, licences, maintenance

| Package | Latest (npm, 2026-11-21) | Licence | Maintenance | Size (raw / gzip, measured) |
| - | - | - | - | - |
| [`elkjs`](https://github.com/kieler/elkjs) | **0.12.1** (2026-10-28), based on ELK 0.12.1 ([release](https://github.com/kieler/elkjs/releases/tag/0.12.1)). A `0.13.0` was published to npm the same day and is **deprecated**, so pin `0.12.1`. | `EPL-2.0 OR GPL-3.0-or-later`. GPL-3.0 was added as a second option in 0.12.0 ([release](https://github.com/kieler/elkjs/releases/tag/0.12.0)). | Active. It tracks Eclipse ELK, which shipped 0.10, 0.11, 0.12 and 0.12.1 between 2025-03 and 2026-10 ([ELK releases](https://github.com/eclipse-elk/elk/releases)). Repo pushed 2026-11-09, 98 open issues. | `elk-worker.min.js` 1.63 MB / 472 KB; `elk-api.js` 10 KB |
| [`@dagrejs/dagre`](https://github.com/dagrejs/dagre) | **3.1.3** (2026-10-24) | MIT | Revived. Rewritten in TypeScript in 3.0.0; 3.1.0 added per-cluster `rankdir` and "dynamic" layout ([changelog](https://github.com/dagrejs/dagre/blob/master/changelog.md)). The unscoped `dagre` package (0.8.5, 2019) is dead; the README says only the `@dagrejs` one gets updates ([README](https://github.com/dagrejs/dagre)). | `dagre.esm.js` 49 KB / 17 KB |
| [`libavoid-js`](https://github.com/Aksem/libavoid-js) | **0.5.0-beta.6** (2026-11-16), tagged `latest` on npm although it is a beta | LGPL-2.1-or-later | One maintainer: "an open-source initiative that we work on in our free time" ([README](https://github.com/Aksem/libavoid-js)). 49 stars, 3 open issues. 0.5 moved to embind with a new API ([commit, 2026-11-16](https://github.com/Aksem/libavoid-js/commits/master)). | `libavoid.wasm` 476 KB / 177 KB, plus 60 KB JS |
| [`@xyflow/react`](https://github.com/xyflow/xyflow) | **13.0.2** (2026-11-17). v13.0.0 shipped 2026-11-16 ([release notes](https://github.com/xyflow/xyflow/releases/tag/%40xyflow%2Freact%4013.0.0)). | MIT | Active, commercially backed. | — |

Licence note: EPL-2.0 is weak copyleft at the file level, so shipping elkjs unmodified inside an MIT or Apache app is normal. LGPL-2.1 for a wasm blob is similar, but it should be checked against Archidocs' own licence, which is not decided yet.

## Requirement-by-requirement comparison

| Need | elkjs `layered` | dagre | libavoid-js |
| - | - | - | - |
| Places nodes | Yes | Yes | **No**, routing only |
| Nodes never overlap | Yes (0 overlaps, measured) | Yes (0 overlaps, measured) | n/a |
| Edges never pass through nodes | **Yes** (0, measured) | **No** (35/260 and 89/200, measured) | Yes, when `shapeBufferDistance` is under half the smallest gap between nodes (see below) |
| Right-angle routing | **Yes**; `ORTHOGONAL` is the layered default ([algorithm ref](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)) | **No**: polyline `points`, 248/260 edges had a diagonal segment (measured) | Yes (`OrthogonalRouting`) |
| Crossing minimisation | Yes, layer-sweep crossing minimisation ([algorithm ref](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)) | Yes (ordering heuristic), on node order only | Penalty only (`crossingPenalty`, marked experimental in [libavoid docs](https://www.adaptagrams.org/documentation/namespaceAvoid.html)) |
| Nested containers, sized automatically | Yes; edges across hierarchy supported with `INCLUDE_CHILDREN` | Yes (`compound: true`, `setParent`); React Flow notes a sub-flow caveat (below) | n/a |
| Ports | Yes: `portConstraints`, `port.side`, `portAlignment.*` | **No** port concept | Pins (`addPin`) with allowed directions |
| Web worker | Built in (`workerUrl` / `workerFactory`) | Plain JS, runs in any worker | wasm; works in a worker (JointJS's integration routes in one, per [README](https://github.com/Aksem/libavoid-js)) |
| Time at ~150 nodes (Node 24, Apple M5) | ~90–115 ms median, ~190 ms first run (measured) | ~100–220 ms (measured) | 30 ms to over 30 s depending on options (measured) |

## Findings by topic

### Nested compound nodes

**ELK.** A compound node is an ELK node with `children`. By default, ELK lays out each container separately (`SEPARATE_CHILDREN`), and edges that leave a container are then handled badly. `INCLUDE_CHILDREN` lays out a container and all its descendants in one run, which "may help lay out cross-hierarchical edges" ([hierarchyHandling](https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html)). The layered algorithm lists "Compound (cross-hierarchy edges to compound nodes)" as supported, "when enabled at the top level" ([algorithm ref](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)). Set it on the root. Containers are sized for you, with `elk.padding` controlling the gap between the border and the children (the top padding leaves room for a System or Environment label).

Coordinates: nodes default to being relative to their parent (`org.eclipse.elk.json.shapeCoords` = `PARENT` at the root). Edge points default to being relative to the edge's *container*, worked out as a lowest common ancestor, which the docs call "tricky to compute correctly". Setting `org.eclipse.elk.json.edgeCoords: ROOT` gives global edge coordinates instead ([coordinate system](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html)). Both options worked in elkjs 0.12.1 in the benchmark. React Flow child positions are also relative to the parent (`parentId`, origin at the parent's top-left; [sub-flows](https://reactflow.dev/learn/layouting/sub-flows)). So keep `shapeCoords` at its default and copy `x`/`y` straight into `position`. Use `edgeCoords: ROOT`, because a custom edge draws in flow (absolute) coordinates.

The 3-level case (Environment, then Deployment Target, then Deployment) worked with the same options: 0 overlaps and 0 edges through nodes **(measured)**.

Open issues to know about, all `INCLUDE_CHILDREN`-specific:
- [elk#1192](https://github.com/eclipse-elk/elk/issues/1192) (open, 2026-06): `IllegalStateException "Expected N hierarchical ports, but found only 0"` on a compound node that has ports and cross-hierarchy edges, triggered by an unused port. Only define ports that edges actually use.
- [elkjs#396](https://github.com/kieler/elkjs/issues/396) (open, 2026-08): "Invalid hitboxes" with `INCLUDE_CHILDREN` plus `postCompaction` `EDGE_LENGTH`. Avoid post-compaction.
- [elkjs#164](https://github.com/kieler/elkjs/issues/164) (open): nested edges sometimes get an unexpected container. Using `edgeCoords: ROOT` sidesteps this.
- A maintainer notes that "INCLUDE_CHILDREN does not always work with model order" ([elk#1069](https://github.com/eclipse-elk/elk/issues/1069)).

**dagre.** It supports compound graphs (`compound: true`, `setParent`), and 3.1.0 added per-cluster `rankdir`, `ranksep`, `nodesep` and `align` ([changelog](https://github.com/dagrejs/dagre/blob/master/changelog.md), [`types.ts`](https://github.com/dagrejs/dagre/blob/master/lib/types.ts)). React Flow's docs still warn that dagre "has an open issue that prevents it from laying out sub-flows correctly if any nodes in the sub-flow are connected to nodes outside the sub-flow" ([layouting overview](https://reactflow.dev/learn/layouting/layouting)). With 3.1.3 and many cross-cluster edges, the benchmark saw no container overlaps. 3.1.x lists fixes for "cross-cluster edges" and "internal edge routes inside clusters", so that warning may be out of date. Edges still came out polyline and through nodes.

### Edge routing that avoids nodes, and right angles

**ELK** routes edges as part of layout: orthogonal routing with `spacing.edgeNode`, `spacing.edgeEdge` and the `*BetweenLayers` spacings ([algorithm ref](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)). Results come back in `edge.sections[]` as `startPoint`, `bendPoints[]` and `endPoint` ([JSON format](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html)). React Flow's overview confirms that ELK is the only listed layouter with edge routing. Without it, edges "fall wherever they may" ([layouting overview](https://reactflow.dev/learn/layouting/layouting)).

One caveat from an ELK maintainer: edges appear to cross nodes when the rendered node is bigger than the size ELK was given. Give ELK the real size (or set `nodeSize.constraints` and `nodeSize.minimum`) ([elk#1069](https://github.com/eclipse-elk/elk/issues/1069)). In React Flow, either use fixed sizes per node kind or lay out after React Flow has measured the nodes.

**libavoid-js** adds shapes as obstacles and routes connectors around them, incrementally on `processTransaction()` ([README](https://github.com/Aksem/libavoid-js), [libavoid RoutingParameter/RoutingOption](https://www.adaptagrams.org/documentation/namespaceAvoid.html)). Findings for Archidocs:
- **Containers must not be added as shapes**, or every edge leaving a System is blocked. libavoid's own cluster support (`ClusterRef`, `clusterCrossingPenalty`, "very slow") is not exposed in libavoid-js 0.5 (no cluster API in the shipped `index.d.ts`). So libavoid sees a flat set of leaf obstacles.
- **Failure mode (measured):** on ELK-placed nodes with a 20 px minimum gap, `shapeBufferDistance: 10` closed every corridor. 21 and 39 edges fell back to straight lines through nodes. With a buffer of 4, that dropped to 0.
- **Run time is erratic (measured):** with the default `performUnifyingNudgingPreprocessingStep: true`, routing dagre's C2 layout took about 8–10 s. With that step and `nudgeOrthogonalSegmentsConnectedToShapes` turned off, it took 70 ms. The deployment graph with buffer 0 took 33 s. The libavoid docs say the preprocessing step "can be very slow" on large examples.
- [`@mr_mint/elkjs-libavoid`](https://github.com/MrMint/elkjs-libavoid) (0.5.0, MIT, 7 stars) runs libavoid over an ELK JSON graph and supports compound nodes and ports. It is useful prior art, but too young to depend on.
- React Flow's own libavoid edge-routing example is a paid Pro example ([edge routing](https://reactflow.dev/examples/edges/edge-routing)).

The real reason to keep libavoid in mind is a later feature, not v1: manual layout (out of scope in the map). When a user drags nodes, edges need re-routing without moving the other nodes. That is libavoid's job, not ELK's.

**Graphviz (not in the ticket, for context).** LikeC4, the closest prior art, lays out with Graphviz via `@hpcc-js/wasm-graphviz` ([`packages/layouts/package.json`](https://github.com/likec4/likec4/blob/main/packages/layouts/package.json)). Graphviz's orthogonal mode ("ortho") "does not handle ports or, in dot, edge labels" ([splines](https://graphviz.org/docs/attrs/splines/)), so it does not beat ELK on these needs.

### Port placement

ELK supports ports as explicit connection points on a node border. `org.eclipse.elk.portConstraints` takes `UNDEFINED`, `FREE`, `FIXED_SIDE`, `FIXED_ORDER`, `FIXED_RATIO` or `FIXED_POS` ([option](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html)). Each port gets a side (`org.eclipse.elk.port.side`) and an alignment (`portAlignment.*`). React Flow's "Elkjs Multiple Handles" example maps each `<Handle>` to an ELK port with a matching id and side, using `portConstraints: FIXED_ORDER` ([example](https://reactflow.dev/examples/layout/elkjs-multiple-handles)).

For Archidocs:
- **Default: no explicit ports.** Edges attach to nodes, and ELK spreads endpoints along the side that faces the layout direction. Render each edge from ELK's start and end points. This avoids [elk#1192](https://github.com/eclipse-elk/elk/issues/1192).
- **If handles are needed** (for example, to keep React Flow's hover and selection behaviour), emit one ELK port per edge end with `FIXED_SIDE` (WEST in, EAST out for `direction: RIGHT`). After layout, place each `<Handle>` at the port's `x`/`y`.
- With `direction: DOWN`, ELK orders NORTH ports in reverse, "a relict from hardware visualization times" ([elk#1006](https://github.com/eclipse-elk/elk/issues/1006)). Prefer `RIGHT`, or test `DOWN` with ports carefully.

dagre has no ports. libavoid has pins (`addPin` with `classId`, a fractional `x`/`y`, and `directions`). When several pins share a class, the router picks the best one per connector.

### Performance at about 150 nodes (measured)

Node 24.14, Apple M5, elkjs 0.12.1 `elk.bundled.js` on the main thread, median of 5 runs after a warm-up:

| Graph | ELK layered (INCLUDE_CHILDREN, ORTHOGONAL) | dagre 3.1.3 | dagre + libavoid (defaults) | dagre + libavoid (preprocessing off) |
| - | - | - | - | - |
| C2: 12 Systems × 11 Services + 6 external = 150 nodes, 260 edges | 113 ms (first run 195 ms) | 218 ms | 8–10 s | 70 ms |
| Deployment: 3 Environments × 4 Targets × 11 Deployments = 147 nodes, 200 edges | 95 ms | 103 ms | 256 ms | 29 ms |

ELK option costs on the C2 graph: `layered.thoroughness: 20` (default 7) took 203 ms and gave no fewer crossings. `nodePlacement.strategy: NETWORK_SIMPLEX` took 207 ms and gave a much shorter drawing (12,951 × 1,772 px against 12,741 × 5,168 px). `crossingMinimization.greedySwitchHierarchical.type: TWO_SIDED` gave 675 crossings against 684. `mergeEdges: true` made crossings worse (757). A browser was not measured, and a worker adds `postMessage` copying. Even with some headroom for that, ELK at ~150 nodes fits comfortably under the ~250 ms an expand or collapse step can afford. The old [elk-speed](https://github.com/kieler/elk-speed) benchmark (2020, Java vs elkjs) has no numbers at this size.

### Running in a web worker

- **elkjs:** pass `workerUrl` (a path to `elk-worker.min.js`) to the `ELK` constructor from `elkjs/lib/elk-api`, or pass a `workerFactory` ([README](https://github.com/kieler/elkjs)). The worker file is a GWT-generated classic script, not an ES module, and bundling it has open issues ([elkjs#141](https://github.com/kieler/elkjs/issues/141), [elkjs#359](https://github.com/kieler/elkjs/issues/359)). Simplest for Vite: write our own module worker that imports `elkjs/lib/elk.bundled.js` and calls `layout()` inside it. That also keeps the 472 KB gzip engine out of the main bundle. In Node (CLI, headless export), workers need the optional `web-worker` package; without it ELK warns and runs inline ([README](https://github.com/kieler/elkjs), [elkjs#354](https://github.com/kieler/elkjs/issues/354)).
- **dagre:** pure JS with no DOM, so it runs in any worker.
- **libavoid-js:** loads its wasm with `AvoidLib.load(path)`. Browsers need the `.wasm` served as a static asset ([README](https://github.com/Aksem/libavoid-js)).

The layout is a pure function from View query result to positions and routes, so it can also run in the CLI at bundle time. That makes static pages and PR previews possible later.

### Stability across small Model changes (measured)

Method: lay out, change the Model slightly, lay out again from scratch. Compare each Service's position relative to its container ("moved" means more than 5 px), and the share of sibling pairs that keep their left/right and above/below order.

| Change | ELK default | ELK + `considerModelOrder.strategy: NODES_AND_EDGES` | dagre |
| - | - | - | - |
| C2: add one Service + 1 edge | 25% moved, order kept 98% | 92% moved, 71% | 15% moved, 100% |
| C2: add one cross-System edge | **91% moved (median 130 px)**, 74% | 92%, 73% | 42%, 97% |
| C2: remove one edge | 20%, 97% | 91%, 80% | 14%, 99% |
| Deployment: add one Deployment | 33%, 91% | same as default | 27%, 99% |
| Deployment: add one edge | 67% (median 120 px), 84% | same | 74%, 99% |

What this shows:
- **ELK is deterministic.** Identical input gives identical output. The layered algorithm's `randomSeed` defaults to 1 ([`Layered.melk`](https://github.com/eclipse-elk/elk/blob/master/plugins/org.eclipse.elk.alg.layered/src/org/eclipse/elk/alg/layered/Layered.melk); 0 means a time-based seed, per [randomSeed](https://eclipse.dev/elk/reference/options/org-eclipse-elk-randomSeed.html)). So input order must be canonical, for example children and edges sorted by Element id. A View that changes nothing in the Model will then never "wiggle".
- **One new edge can reshuffle a whole Layout in ELK.** One edge can change layer assignment, which cascades.
- **ELK's stability options did not help here.** `considerModelOrder` ([option](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-considerModelOrder-strategy.html)) made C2 worse and did nothing on the 3-level graph, consistent with the maintainer's warning about `INCLUDE_CHILDREN`. `crossingMinimization.semiInteractive: true`, seeded with the previous positions, changed nothing. The fully interactive strategies (`cycleBreaking`, `layering` and `crossingMinimization` set to `INTERACTIVE`) **throw** `UnsupportedGraphException: The hierarchy aware processor LAYER_SWEEP …` with `INCLUDE_CHILDREN`.
- **dagre is visibly more stable** (97–100% of sibling order kept). Its 3.1 "dynamic" mode, on by default and keyed to the same `Graph` object ([PR #512](https://github.com/dagrejs/dagre/pull/512), [`layout.ts`](https://github.com/dagrejs/dagre/blob/master/lib/layout.ts)), barely changed these numbers. But dagre's stability comes with layouts that break the definition.

Since Layout is never stored (manual layout is out of scope), "stability" in v1 means two things. Between Model versions, the same Model must give the same picture, which determinism plus canonical ordering covers. Within a session, expand and collapse should not disorient, so animate node and edge moves. Keeping positions across Model versions would need stored Layout hints, which belongs with the future manual-layout work.

## Wiring ELK output into React Flow

- **Nodes.** Each Element in the View becomes an ELK node: a leaf with `width`/`height`, or a container with `children` and no size. After layout, set React Flow `position = {x, y}` (relative to the parent) and `parentId`. Containers also get `style: {width, height}` from ELK. In v13, parents no longer have to come before children in the nodes array ([#5915](https://github.com/xyflow/xyflow/pull/5915)).
- **Edges.** Use a custom edge type that reads `data.points` (ELK `startPoint`, `bendPoints`, `endPoint` in ROOT coordinates). Draw them as an SVG path through `<BaseEdge path=…/>`, ignoring React Flow's computed `sourceX`/`targetX`. React Flow supports arbitrary paths for custom edges ([custom edges](https://reactflow.dev/learn/customization/custom-edges)). Round the corners in the path string if wanted. Edges attached to a node inside a container render above nodes by default ([sub-flows](https://reactflow.dev/learn/layouting/sub-flows)).
- **Interaction.** Set `nodesDraggable={false}`, since manual layout is out of scope. Then ELK's routes never go stale.
- **Async.** `elk.layout()` returns a Promise. React Flow's ELK example awaits it, then calls `setNodes`, `setEdges` and `fitView()` ([elkjs example](https://reactflow.dev/examples/layout/elkjs)). Keep the previous Layout on screen until the new one arrives.

## Benchmark method

- **Environment.** A throwaway Node script (`elkjs@0.12.1`, `@dagrejs/dagre@3.1.3`, `libavoid-js@0.5.0-beta.6`, Node 24.14, Apple M5, 16 GB), written in the session scratchpad and not kept in the repo.
- **Graphs.** Generated with a fixed-seed PRNG:
  - C2: 12 containers of 11 leaves (160×70) plus 6 top-level leaves. Edges are chains and random links inside each System, plus about 80 cross-System and external edges.
  - Deployment: 3 × 4 × 11 nesting with leaves of 160×60, and 200 edges mostly within one Environment.
- **ELK options.** `algorithm: layered`, `direction: RIGHT`, `hierarchyHandling: INCLUDE_CHILDREN`, `edgeRouting: ORTHOGONAL`, `spacing.nodeNode: 30`, `layered.spacing.nodeNodeBetweenLayers: 60`, `spacing.edgeNode: 20`, `spacing.edgeEdge: 10`, `padding: [top=40,left=20,bottom=20,right=20]`, `json.edgeCoords` and `json.shapeCoords: ROOT`.
- **dagre options.** `rankdir: LR`, `nodesep: 30`, `ranksep: 60`, `edgesep: 10`.
- **libavoid options.** Orthogonal, `shapeBufferDistance: 10`, `idealNudgingDistance: 8`, `segmentPenalty: 50`, one centre pin per leaf, containers not added as obstacles.
- **Checks.**
  - Overlap: sibling rectangles intersect by more than 0.5 px.
  - Through-node: a route segment intersects a leaf that is not the edge's endpoint, shrunk by 1 px.
  - Orthogonality: no diagonal segment.
  - Crossings: proper intersections between segments of different edges. These are not comparable between polyline and orthogonal routes.

The generated graphs are synthetic. They have more cross-System edges than a curated C2 View would, so treat the stability numbers as a worst case.

## Recommendation

**Engine: elkjs 0.12.1 (pin it), `layered` algorithm, run in a dedicated module web worker, used alone.** Do not adopt dagre. Keep libavoid-js out of v1, and revisit it only for manual layout later.

Starting options for the [prototype ticket](../issues/09-auto-layout-prototype.md):

```ts
{
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',                       // compare DOWN for C1 and Deployment Views
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',    // on the root only
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.json.edgeCoords': 'ROOT',                  // edges in flow coordinates; node coordinates stay parent-relative
  'elk.spacing.nodeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '10',
  'elk.padding': '[top=40,left=20,bottom=20,right=20]', // on containers; top leaves room for the label
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', // vs default BRANDES_KOEPF: much more compact in the test
}
```

What the prototype should test:
1. **The definition, checked automatically.** Run the overlap, through-node and orthogonality checks above against the *rendered* React Flow nodes, not just ELK's numbers. This catches size mismatches ([elk#1069](https://github.com/eclipse-elk/elk/issues/1069)). Decide between fixed sizes per node kind and measuring first.
2. **Node placement.** `NETWORK_SIMPLEX` against `BRANDES_KOEPF`. Then `crossingMinimization.greedySwitchHierarchical.type: TWO_SIDED` and `layered.thoroughness` (7 against 20), judging crossings, drawing size and time.
3. **Direction.** `RIGHT` against `DOWN` for each View kind (C1, C2, Deployment). With `DOWN` and ports, watch the reversed NORTH port order ([elk#1006](https://github.com/eclipse-elk/elk/issues/1006)).
4. **Ports.** None (the default) against one port per edge end with `portConstraints: FIXED_SIDE`. Emit only ports that edges use ([elk#1192](https://github.com/eclipse-elk/elk/issues/1192)).
5. **Edges to expanded containers.** A Relationship drawn to a System box rather than to a Service inside it should route correctly under `INCLUDE_CHILDREN`.
6. **Stability.** Sort children and edges by Element id. Add one Element and one Relationship to real C2 and Deployment graphs and measure the moved share and the sibling-order share as above. Try `considerModelOrder.strategy` (`NODES_AND_EDGES`, `PREFER_EDGES`) and `crossingMinimization.forceNodeModelOrder` again on real data. Do not use the `INTERACTIVE` strategies, which throw with `INCLUDE_CHILDREN`. Add animated transitions on expand and collapse.
7. **Time in the browser.** Measure the worker round-trip (including `postMessage`) at 50, 150 and 250 nodes. Target under 250 ms at 150 nodes. Avoid `layered.compaction.postCompaction` ([elkjs#396](https://github.com/kieler/elkjs/issues/396)).

**Fallback if ELK's stability is not acceptable on real data:** dagre 3.1.3 for node placement, followed by libavoid-js orthogonal routing. Set `shapeBufferDistance` below half the smallest node gap. Turn off `performUnifyingNudgingPreprocessingStep` and `nudgeOrthogonalSegmentsConnectedToShapes`. Do not add containers as obstacles. Budget for libavoid's run-time variance and its LGPL licence.
