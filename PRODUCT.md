# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People across an engineering organisation who need a trustworthy answer to one architecture question, usually arriving in the viewer from a link shared in a pull request, a chat thread or an incident channel. They must orient fast and leave with the answer. This audience wins when design choices conflict.

The six persona questions the viewer must answer (from `.scratch/archidocs-v1/spec.md`):

- **Enterprise Architect:** how are two Services connected?
- **Solutions Architect:** where is a Service deployed?
- **Developer:** what does my Team own?
- **Product Owner:** what is upstream and downstream of an outage?
- **QA Tester:** what is a Service's URL in a given Environment?
- **Technical staff:** which decisions (ADRs) sit behind an Element, and how did the system change over time?

Architects who curate Saved Views over longer sessions are a secondary audience. AI agents read and edit the same Model through MCP, not through the viewer.

## Product Purpose

Archidocs is an open-source, self-hosted, git-native architecture-as-code tool. Teams declare their slice of the architecture as YAML in their own Project folder of one Workspace repo; Archidocs validates and combines them into one Model and publishes a static viewer site and an MCP server from it. Success: each persona question can be answered in the viewer and through MCP, and nobody needs to ask several Teams.

## Positioning

The diagrams are generated from the validated Model at a commit, never drawn by hand, so they do not go stale. First-class Team ownership, a URL per Environment, transitive impact queries and multi-Team Projects live in one tool. Every screen of the viewer is a URL, and every View can be expressed as Saved View YAML or an `upsert_view` MCP call, so people and agents work on the same source of truth.

## Operating Context

- The viewer is a static site built by `archidocs build` and published from CI (GitHub Action or GitLab template), with past Revisions for history and comparison.
- Visitors arrive by deep link (`#/view/…?sel=…&impact=…`), use Find (`/`), the Model, Teams and Views trees, and lenses (Impact, Connect to…, Team, Where is it deployed?).
- Diagrams export to SVG or PNG for docs and slide decks; Save as View produces YAML to commit, not a server-side save.
- Workspaces range from a handful of Elements to hundreds of boxes on a production Deployment View.

## Capabilities and Constraints

- Terms follow `GLOSSARY.md` (Workspace, Project, Element, Person, System, Service, Component, External, Relationship, Team, Environment, Deployment Target, Revision, Lens, Saved View).
- Viewer shell and behaviour are settled by ticket 14 (`.scratch/archidocs-v1/issues/14-viewer-ux.md`, variant D "Explorer, focused"): rail with Find, Model, Teams and Views flyouts; location bar with breadcrumbs, chips, back/forward, Recent and Copy link; canvas; Element panel shown only while something is selected.
- Team colour is a generated OKLCH palette (golden-angle hues), shown as a stripe on the node and always paired with the Team code (ticket 14).
- Layout is automatic (elkjs, `BRANDES_KOEPF`), direction `TB | BT | LR | RL`; animated transitions on up to 100 nodes, always off under `prefers-reduced-motion`.
- The viewer is read-only; it never writes to the Workspace repo.

## Brand Commitments

- Name: **Archidocs**.
- Logo: the "Doorway tile" mark the user chose (option C): a rounded tile with an arched doorway opening through its base and an indigo (`#5146E5`) keystone above the arch. Files and usage are in `assets/brand/`.

## Evidence on Hand

- Sample Workspaces: the kitchen-sink fixture and the Big Bank plc demo (`examples/`).
- No testimonials, customer names, benchmarks or adoption figures exist; do not fabricate any.

## Product Principles

1. **Answer the question in the link.** A visitor arriving from a URL should see the answer it points at before anything else.
2. **The Model is the truth.** The viewer shows what was declared and validated at a commit; it never implies hand-drawn or editable state.
3. **Every screen is shareable.** Anything visible can be reopened by its URL and turned into Saved View YAML.
4. **Ownership is always visible.** Every Element carries its Team; colour never carries it alone.
5. **Same answers for people and agents.** What the viewer shows, MCP can answer, and vice versa.

## Accessibility & Inclusion

WCAG 2.2 AA: text and non-text contrast, every flow operable by keyboard (including selecting and picking nodes), visible focus, no meaning carried by colour alone, and reduced motion respected.
