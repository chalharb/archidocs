# 15: Element panel, Find and Lenses

Status: done
Assignee: Claude (Opus 5.5)
Blocked by: 07, 08, 14
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

The persona questions can be answered in the viewer.

- Find (`/`): matches name, id, Team, technology and URL. Focusing a result stays in the current View when it can.
- An Element panel shown on selection, with tabs:
  - Overview: description, technology, persona actions;
  - URLs: per Environment and Target, with copy buttons and named endpoints;
  - Links: Relationships, Downstream and Upstream.
- Lenses, held in the URL and shown as a chip with ✕:
  - **Impact:** upstream, both or downstream, with distance badges. An edge lights only when it steps one hop closer to the origin; everything else dims.
  - **Connect to…:** Shortest or All ≤ 4 hops. The nodes on the paths are picked.
  - **Team:** owned nodes are ringed.
  - Collapsed boxes are marked when anything inside them is hit.
- Lens marks come from the same core queries as MCP.

## Acceptance criteria

- [x] Playwright acceptance tests answer the Enterprise Architect, Developer, Product Owner and QA Tester questions in the viewer.
- [x] A Lens survives a reload via the URL.
