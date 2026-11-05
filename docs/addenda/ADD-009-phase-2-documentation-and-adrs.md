# ADD-009: Phase 2 requirements — architecture documentation and ADRs

| Field | Value |
|---|---|
| **Status** | Proposed |
| **Type** | Addition |
| **Proposed** | 2026-11-05 by Claude, at Logan Harber's request |
| **Decided** | |
| **Baseline** | PRD v1.7 |
| **Affected IDs** | DOC-01..09 (new), ADR-01..05 (new), SEC-11..12 (new), TEST-08 (new), E2E-06..08 (new), VR-10..11 (new), BENCH-07 (new), PH2-01..06, PH2-EXIT (new), RELI-01..05, MODEL-07, DIAG-07 |
| **PRD sections** | §2, §3, §5, §6, §7, §8, §11 |

## Context

PRD §11 outlines Phase 2 in one line: "Markdown documents, structured ADRs, entity traceability, supersession, reverse references, and documentation navigation." Checklist 09 requires each later phase to be broken into detailed requirements by an addendum before work starts. This addendum does that for Phase 2.

The design follows the principles that held for Phases 0 and 1: files in the workspace are canonical, external editing is a first-class workflow, invalid input never overwrites valid data, and the app writes only what it must.

**Open questions** are listed at the end, each with the default this addendum assumes. Accepting the addendum accepts those defaults unless the decision says otherwise.

## Change

### Storage: Markdown with front matter

Documents and decisions are Markdown files (`*.md`) anywhere in the workspace. Each one starts with a YAML front-matter block that is an `archdocs/v1` resource. The Markdown after the block is the body.

```markdown
---
apiVersion: archdocs/v1
kind: Decision
id: adr-0002
title: Use PostgreSQL for the ledger
status: accepted
date: "2026-03-14"
deciders: [Payments team]
entities: [ledger-db, payments-api]
supersedes: [adr-0001]
---

## Context

The [Payments API](entity:payments-api) needs transactional writes...

## Decision

## Consequences
```

- Two new resource kinds, `Document` and `Decision`, are added to `archdocs/v1`. This is additive: existing files stay valid and no migration is needed (SCHEMA-10).
- Discovery also reads `*.md` files, with the same skip rules, size limit (1 MiB) and file-count budget as YAML. A Markdown file is a resource only if it begins with front matter whose `apiVersion` is `archdocs/v1`. Other Markdown files, such as a workspace `README.md`, are ignored.
- Front matter is parsed with the same safe YAML parser and limits as other resources (SEC-05, SEC-06), and validated strictly (SCHEMA-01, SCHEMA-08).
- Front matter holds exactly one resource. `---` separators in the body are Markdown, not YAML documents.

### Resource kinds

| Kind | Required | Optional |
|---|---|---|
| `Document` | `id`, `title` | `description`, `owner`, `tags`, `entities[]`, `diagrams[]`, `properties` |
| `Decision` | `id`, `title`, `status`, `date` | `description`, `deciders[]`, `tags`, `entities[]`, `diagrams[]`, `supersedes[]`, `properties` |

- `status` is one of `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`.
- `date` is an ISO date string, `YYYY-MM-DD`. It stays a string (no YAML timestamps).
- `entities[]` and `diagrams[]` reference canonical entity and diagram IDs. `supersedes[]` references decision IDs.
- Document and decision IDs are each unique workspace-wide (SCHEMA-03), as separate categories.
- Decision IDs are free-form. `adr-NNNN` is the recommended convention, not enforced.

### Documents

**DOC-01** (new): Load Markdown documents and decisions with `archdocs/v1` front matter from anywhere in the workspace. Markdown files without such front matter are ignored. — P0, Phase 2

**DOC-02** (new): Validate front matter strictly. Invalid front matter is reported with file and line, like other schema errors, and the file is excluded from the model. — P0, Phase 2

**DOC-03** (new): Entity traceability. Front-matter `entities[]` and `diagrams[]` must resolve to existing IDs. Unresolved references are warnings, not errors, so documentation never blocks a model reload. — P0, Phase 2

**DOC-04** (new): Inline model links. In the body, links of the form `[text](entity:<id>)`, `[text](diagram:<id>)`, `[text](decision:<id>)` and `[text](document:<id>)` resolve to the corresponding page. Unresolved links are warnings with line numbers, and render as plain text marked as broken. Relative links to other workspace Markdown files resolve to that file's page when it's a resource. — P0, Phase 2

**DOC-05** (new): Reverse references. The graph index records which documents and decisions reference each entity and diagram, through front matter or inline links. The entity inspector (DIAG-07) and a diagram's view route list them, with decisions grouped by status. — P0, Phase 2

**DOC-06** (new): Documentation navigation:

| Route | Purpose |
|---|---|
| `/workspaces/<key>/docs` | Document index: title, description, tags, filterable by title and tag |
| `/workspaces/<key>/docs/<id>` | Rendered document with its metadata and links to referenced entities and diagrams |
| `/workspaces/<key>/decisions` | Decision log (ADR-04) |
| `/workspaces/<key>/decisions/<id>` | Rendered decision (ADR-05) |

The workspace home page links to the document index and the decision log. Entity links open the related diagram view with that entity focused, or an entity page if the entity appears in no diagram. — P0, Phase 2

**DOC-07** (new): Live reload. External changes to Markdown resources are detected and reloaded like YAML (RELI-01..05): valid changes refresh open pages, and invalid changes keep the last valid version with a stale indicator and diagnostics. — P0, Phase 2

**DOC-08** (new): Read-only documentation. The app never creates, modifies or deletes Markdown files. Documents and decisions are edited in the user's own editor. — P0, Phase 2

**DOC-09** (new): The sample workspace includes at least two documents and three decisions, including one supersession chain and one inline link of each kind, so it doubles as the Phase 2 example. — P0, Phase 2

### Decisions (ADRs)

**ADR-01** (new): Structured decisions use the `Decision` kind, with the fields and statuses above. — P0, Phase 2

**ADR-02** (new): Recommended sections. A decision body should contain `## Context`, `## Decision` and `## Consequences` headings, matched case-insensitively. Missing sections are warnings (`ADR_SECTION_MISSING`), not errors. — P1, Phase 2

**ADR-03** (new): Supersession. Only `supersedes` is authored; "superseded by" is derived. Validation:
- A decision that is superseded by another must have `status: superseded`, and a decision with `status: superseded` must be superseded by at least one decision. Either mismatch is a warning.
- Supersession cycles are errors, reported on every decision in the cycle.
- `supersedes` references to unknown decisions are warnings.
— P0, Phase 2

**ADR-04** (new): Decision log. Lists decisions with ID, title, status, date and linked entities. Filterable by status, entity and tag. Sorted by date, newest first, then by ID. Superseded decisions are shown but de-emphasised. — P0, Phase 2

**ADR-05** (new): Decision page. Shows a status badge, date and deciders. A superseded decision shows a banner linking to the decisions that supersede it, and each decision links to the ones it supersedes, so the whole chain can be followed in both directions. — P0, Phase 2

### Security

**SEC-11** (new): Safe Markdown rendering. Markdown is rendered on the server to sanitised HTML:
- Raw HTML in Markdown is not rendered.
- Only `http`, `https`, `mailto`, relative links and the model schemes in DOC-04 are allowed. Others, such as `javascript:` and `data:`, are dropped.
- Nothing is loaded from remote origins. External links open in a new tab with `rel="noopener noreferrer"`.
- Sanitisation is covered by a fixture suite of known XSS payloads.
— P0, Phase 2

**SEC-12** (new): Workspace images. Images referenced by relative paths are served through the repository service, confined to the workspace root (SEC-02..04), limited to PNG, JPEG, GIF, WebP and SVG, and to 5 MiB each. SVG is served as an image with a restrictive Content-Security-Policy, never inlined. Remote image URLs render as links, not images. — P1, Phase 2

### Testing and performance

**TEST-08** (new): Documentation test categories:
- Front-matter parsing: valid, missing, malformed, wrong kind, unsupported version, limits.
- Reference and link resolution, including broken links with line numbers.
- Supersession: consistency warnings and cycles.
- Reverse-reference indexing, deterministic regardless of file order.
- Sanitisation fixtures (SEC-11) and image confinement (SEC-12).

New Playwright workflows:
- **E2E-06:** Open a document from the home page, follow an entity link to its diagram, and get back to the document through the inspector's reverse references.
- **E2E-07:** Filter the decision log by status and entity, and follow a supersession chain in both directions.
- **E2E-08:** Edit a decision's Markdown externally and see the page reload. Then break its front matter and see the last valid version with diagnostics.

New visual regression snapshots: **VR-10** document page, **VR-11** decision page with a superseded banner.

**BENCH-07** (new): Load a workspace with 100 entities and 200 Markdown resources in under 1.5 s, cold, on the reference machine (PERF-05).

### Phase 2 exit criterion

**PH2-EXIT** (new): A user can write architecture documentation and decisions in Markdown that link to the YAML model, and navigate between documents, decisions, entities and diagrams in both directions, without the app modifying any canonical file.

The outline items in checklist 09 map to these requirements: PH2-01 → DOC-01, 02, 06; PH2-02 → ADR-01, 02; PH2-03 → DOC-03, 04; PH2-04 → ADR-03, 05; PH2-05 → DOC-05; PH2-06 → DOC-06, ADR-04.

### Out of scope for Phase 2

- Editing Markdown in the app (DOC-08).
- Embedding live diagrams in documents.
- Full-text search. Lists filter by title, tag, status and entity only.
- Remote images and other remote content.
- ADR templates other than the three recommended sections.

## Open questions

Each has the default this addendum assumes.

1. **Where front matter lives.** Default: in the Markdown file, so documents read naturally on GitHub. The alternative is a separate YAML resource pointing to a Markdown file, which keeps all metadata in YAML but splits each document across two files.
2. **Editing in the app.** Default: read-only (DOC-08), which keeps the rule that the app writes only presentation files. In-app editing would need conflict handling, drafts and Markdown-preserving writes, so it's a candidate for a later phase.
3. **Plain Markdown files.** Default: Markdown without `archdocs/v1` front matter is ignored. The alternative is to list it as untyped documents, titled from the first heading.
4. **Embedded diagrams.** Default: out of scope. A fenced block such as ` ```archdocs-diagram containers ``` ` rendering a static diagram could be added later without schema changes.
5. **Decision statuses.** Default: the fixed set of five above. A configurable set would need a new resource kind.
6. **Search.** Default: filters only. Full-text search would need an index and its own performance budget.

## Consequences

- **Schema:** two additive kinds. Discovery and the watcher extend to `*.md`, which changes what counts toward the 5,000-file workspace budget. The budget becomes YAML plus Markdown resources.
- **Model and index:** documents and decisions join the normalized model and graph index, so reverse references and diagnostics reuse the Phase 0 machinery, and snapshot versioning covers them.
- **Dependencies:** a Markdown pipeline and a sanitiser (for example `remark`/`rehype` with `rehype-sanitize`). These need version pinning and a security review.
- **UI:** new routes and an extended inspector. Diagram pages gain a documentation section. No change to the layout editor.
- **Unchanged:** nothing in Phases 0 and 1 changes behaviour. Existing workspaces without Markdown resources load exactly as before.

## Checklist updates

To do on acceptance:

- [ ] Create `docs/checklists/10-documentation.md` with DOC-01..09 and ADR-01..05, each "(added by ADD-009)"
- [ ] Add SEC-11..12 to `05-security.md`; TEST-08, E2E-06..08 and VR-10..11 to `06-testing.md`; BENCH-07 to `07-performance.md`
- [ ] In `09-later-phases.md`, add PH2-EXIT and point PH2-01..06 at the new items
- [ ] Add `DOC-` and `ADR-` to the ID families in `docs/README.md`, and record all new IDs in the allocated-IDs table
- [ ] Run `scripts/prd-progress.sh --write`
