# Auto-layout engines for React Flow

Type: research
Status: resolved
Blocked by: –
Map: [Archidocs v1](../map.md)

## Question

Which layout engine (ELK.js layered with orthogonal routing, dagre, libavoid-js, or a combination) best meets the map's auto-layout definition inside React Flow? Cover: nested compound nodes (Systems around Services, Environments and Deployment Targets around Deployments), edge routing that avoids nodes, port placement, performance at about 150 nodes, running in a web worker, and how stable the layout stays across small Model changes.

## Answer

**Use elkjs on its own:** pin 0.12.1 (the 0.13.0 release on npm is deprecated), with the `layered` algorithm, `hierarchyHandling: INCLUDE_CHILDREN` and `edgeRouting: ORTHOGONAL`, run in a web worker. It was the only candidate that met all four auto-layout rules on two synthetic 150-node graphs, one with 2 levels of nesting and one with 3: no node overlaps, no edges through nodes, every edge right-angled, about 90–115 ms per layout in Node. It wasn't measured in a browser.

- **dagre (3.1.3):** handles nested nodes but draws diagonal edges, and 35 of 260 and 89 of 200 edges went through nodes. Rejected.
- **libavoid-js (0.5 beta, LGPL, one maintainer):** routes edges only and doesn't place nodes. Paired with dagre it met all four rules, but routing took anywhere from 30 ms to over 30 s depending on settings and the gaps between nodes. Kept as a fallback only.
- **Risk, layout stability:** the same input always gives the same picture, but adding one Relationship moved about 90% of Services in the 2-level graph by a median of 130 px. The random test graphs had many links between Systems, so this is likely a worst case. ELK's options that would keep earlier positions throw an error when used with nested layout. The prototype needs a stable input order (sorted by Element id), animated transitions, and measurements on real graphs.

Findings: [research/02-auto-layout-engines.md](../research/02-auto-layout-engines.md)
