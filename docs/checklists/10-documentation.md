# Architecture Documentation and ADRs (Phase 2)

Source: [ADD-009](../addenda/ADD-009-phase-2-documentation-and-adrs.md). Conventions: [checklists/README.md](README.md).

Security, testing and performance items for Phase 2 are in checklists 05 (SEC-11..12), 06 (TEST-08, E2E-06..08, VR-10..11) and 07 (BENCH-07). The exit criterion (PH2-EXIT) is in checklist 09.

## Documents

- [ ] **DOC-01** `P0` `Phase 2` — Load Markdown documents and decisions with `archdocs/v1` front matter from anywhere in the workspace; ignore other Markdown (added by ADD-009)
- [ ] **DOC-02** `P0` `Phase 2` — Validate front matter strictly; report invalid front matter with file and line and exclude the file (added by ADD-009)
- [ ] **DOC-03** `P0` `Phase 2` — Entity traceability: front-matter `entities[]` and `diagrams[]` resolve; unresolved references are warnings (added by ADD-009)
- [ ] **DOC-04** `P0` `Phase 2` — Inline `entity:`, `diagram:`, `decision:` and `document:` links and relative Markdown links resolve; broken links are warnings with line numbers and render as broken (added by ADD-009)
- [ ] **DOC-05** `P0` `Phase 2` — Reverse references from entities and diagrams to documents and decisions, shown in the entity inspector and the diagram view (added by ADD-009)
- [ ] **DOC-06** `P0` `Phase 2` — Document index and pages, decision log and pages, linked from the home page; entity links open the related diagram focused (added by ADD-009)
- [ ] **DOC-07** `P0` `Phase 2` — Live reload of Markdown resources with last-valid-version and stale indicator, like YAML (added by ADD-009)
- [ ] **DOC-08** `P0` `Phase 2` — The app never creates, modifies or deletes Markdown files (added by ADD-009)
- [ ] **DOC-09** `P0` `Phase 2` — Sample workspace has at least two documents and three decisions, a supersession chain, and one inline link of each kind (added by ADD-009)

## Decisions (ADRs)

- [ ] **ADR-01** `P0` `Phase 2` — `Decision` kind with `status` (proposed, accepted, rejected, deprecated, superseded), `date`, `deciders`, `entities`, `diagrams`, `supersedes` (added by ADD-009)
- [ ] **ADR-02** `P1` `Phase 2` — Recommended Context, Decision and Consequences sections; missing ones are `ADR_SECTION_MISSING` warnings (added by ADD-009)
- [ ] **ADR-03** `P0` `Phase 2` — Supersession: `supersededBy` derived; status mismatches and unknown references are warnings; cycles are errors (added by ADD-009)
- [ ] **ADR-04** `P0` `Phase 2` — Decision log filterable by status, entity and tag, sorted by date then ID, superseded de-emphasised (added by ADD-009)
- [ ] **ADR-05** `P0` `Phase 2` — Decision page with status, date, deciders, and supersession links in both directions (added by ADD-009)
