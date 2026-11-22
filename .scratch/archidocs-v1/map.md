# Archidocs v1

Label: wayfinder:map

## Destination

A **v1 spec** for Archidocs, a git-native, AI-first architecture-as-code tool. It locks the decisions on the domain model, authoring format, Workspace aggregation, history, MCP tools, authoring skill, Views (C1–C3, Deployment, Dynamic), and viewer and auto-layout, in enough detail to split into implementation tickets. Building it is a separate effort.

**Acceptance:** each persona question can be answered both through MCP and in the viewer:
1. Enterprise Architect: how are two Services connected?
2. Solutions Architect: where is a Service deployed?
3. Developer: what does my Team own?
4. Product Owner: what is upstream and downstream of an outage?
5. QA Tester: what is a Service's URL (in a given Environment)?
6. Technical resource: read or propose ADRs; see how the system changed over time.

## Notes

- **Domain:** software architecture modelling. Vocabulary lives in [GLOSSARY.md](../../GLOSSARY.md); every session reads it first and calls the Skill tool for `domain-modeling` whenever terms change.
- **Product shape:** open source, self-hosted, git-native. CLI + static viewer + MCP server. TypeScript throughout (React + React Flow viewer, Node CLI and MCP server).
- **Source of truth:** declared Model files in one git repo (the Workspace); each Project is a folder in it. CI builds a Workspace Bundle; the viewer and MCP read the bundle or a local checkout.
- **Not a wrapper:** prior art (LikeC4, Structurizr, Backstage, IcePanel) informs the design; Archidocs doesn't wrap or depend on any of them.
- **AI-first, harness-agnostic:** standard MCP only; everything essential is a tool; stdio and Streamable HTTP transports; no client-specific features. Authoring guidance is served through MCP; SKILL.md or AGENTS.md wrappers are conveniences on top.
- **Diagram range:** C1 (context), C2 (Services/containers), C3 (Components), Deployment Views, and Dynamic Views rendered as sequence charts. Views are queries over the Model, never sources of truth. Layout is kept apart from the Model.
- **Auto-layout definition:** nodes never overlap, edges never pass through nodes, edges use right-angle routing, crossings are kept to a minimum (not zero).
- **Scale target:** about 50 Projects, 1,000 Elements and 3,000 Relationships per Workspace; no more than about 150 nodes per View, with expand and collapse.
- **ADRs:** markdown in git, linked to Elements; proposing one means opening a PR with status Proposed.
- **History:** Workspace history is the repo's git history; a Workspace Bundle can be rebuilt for any commit.
- **CI:** the Workspace repo runs `archidocs check` over every Project in one pass.
- **Tracker:** local markdown. Tickets are in `issues/`; research findings are in `research/`.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [How existing tools model architecture](issues/01-prior-art-modelling.md): no tool covers all six personas; recurring gaps are ownership, URL per Environment, transitive impact, and multi-repo. Suggests fixed C1–C3 kinds and YAML + JSON Schema (input for the model and format tickets).
- [Auto-layout engines for React Flow](issues/02-auto-layout-engines.md): elkjs 0.12.1 alone (layered, nested, orthogonal, in a worker) met every rule at 150 nodes in ~100 ms; dagre fails, libavoid is the fallback; stability across edits is the open risk.
- [MCP client support for a harness-agnostic server](issues/03-mcp-client-support.md): only tools are universal; stateless tools with structuredContent + text, stdio then Streamable HTTP on TS SDK v2, guidance via a `get_authoring_guide` tool plus a portable SKILL.md.
- [Rendering sequence charts for Dynamic Views](issues/04-sequence-chart-rendering.md): React Flow plus our own row-based layout function (participant nodes with lifelines, steps as edges); no library fits, custom SVG rejected.
- [Core domain model](issues/05-core-domain-model.md): fixed Person/System/Service/Component kinds with strict nesting; Relationships stored as declared and higher edges derived; one Owner per Element; topics are `via`/`channel` fields on async Relationships; URLs live only on Deployments; flat per-Project slug ids.
- [Authoring format](issues/06-authoring-format.md): YAML 1.2 checked against a JSON Schema generated from TypeScript (zod) types, not a TS API; an `archidocs/` folder of files per Project, Elements nested as a tree (`in:` to attach across files), Relationships listed under their consumer.
- [Workspace aggregation](issues/07-workspace-aggregation.md): one repo per Workspace in v1; `workspace.yaml` holds Teams and Environments, Projects are auto-discovered folders with a `project.yaml`, other Projects are referenced as `project:id`, the Bundle is one JSON file per commit, and history comes from git.
- [MCP tool surface](issues/08-mcp-tool-surface.md): about 10 specific read tools mapped to persona questions (`find_paths`, `get_impact`, `list_owned`, `get_deployments`, ADR tools) plus search and `get_element`; qualified ids only; one source per process (checkout or Bundle URL); comment-preserving write tools on a checkout only, validated against the whole Workspace and never committing; typed `isError` results.
- [View kinds and definitions](issues/10-view-definitions.md): Generated Views for every scope (C1 and C2 Landscapes, C2 per System, C3 per Service, Deployment per Environment) plus optional Saved Views in Project YAML as structured include/exclude queries; Dynamic View Steps are `from`/`to` resolved to a Relationship, with return Steps; Deployment edges go to the nearest provider Deployment; `list_views`, `get_view`, `upsert_view`, `remove_view`.
- [ADR format and linking](issues/11-adr-format.md): MADR-style markdown in each Project's `adr/` folder, numbered per Project (`project:NNNN`); frontmatter links `elements` and Saved `views`; Proposed lives on PR branches; `supersedes` declared once on the new ADR and `superseded` derived; overridable templates; an Element's timeline includes its descendants' ADRs.
- [archidocs check](issues/16-archidocs-check.md): one validator shared by `check`, `build` and MCP writes; about 33 kebab-case rules (errors, plus two View warnings), records `{file, line, column?, rule, severity, message}`, `--format text|json|github`, exit 0/1/2 with `--strict`; nothing configurable in v1.
- [Sequence chart prototype](issues/13-sequence-chart-prototype.md): Dynamic Views get a play transport over a numbered Step outline, the chart, and a detail panel whose buttons open the Generated Views holding the Step's Relationship; event Steps are left to their own ticket.
- [Authoring skill](issues/12-authoring-skill.md): one `archidocs-authoring` skill served by `get_authoring_guide(topic)` and `archidocs guide`, with a thin stub installed by `archidocs init`; works from a code repo via `archidocs mcp --workspace`; edits through MCP write tools only, never committing; bootstrap is one-shot agent guidance (inventory with evidence, one approval, outbound Relationships only) plus a new `create_project` tool.
- [Auto-layout engine prototype](issues/09-auto-layout-prototype.md): elkjs with each container laid out on its own and edges bundled at container borders (keeps untouched Systems stable); every rule met, about 90–125 ms for C2 up to 225 nodes; direction `TB | BT | LR | RL` per View; Deployment Views group Deployments by System inside each Target.
- [Viewer UX](issues/14-viewer-ux.md): variant D "Explorer, focused": a rail with collapsible Model and Views trees (by kind or by Team), a location bar whose state lives in the URL (back/forward, Recent, links), an Element panel only on selection (Overview, URLs, ADRs, Links); persona questions as lenses over any View; shift-click or start/end picking exports SVG/PNG or saves a Saved View; animation off above 100 nodes; Brandes-Köpf placement.
- [Event Steps in Dynamic Views](issues/17-event-steps.md): event Steps are written publisher → subscriber and resolve to the reverse `via` subscription (ambiguity is an error); the broker is not a participant, with a viewer-only "Show brokers" toggle drawing `na`/`nb` legs; returns only on sync; `get_view` Steps gain `kind: call | return | event` plus `via`/`channel`; new `return-on-async` rule.
- [History UX](issues/15-history-ux.md): points are refs or dates over default-branch Revisions; CI publishes `bundles/<sha>.json` plus an `index.json` of changed ids, checkouts build on demand and cache; diffs list Changes matched by id (Relationships by id, else pair) with effective Owner; `at` on read tools, `get_changes`, `list_history`; viewer `at` and a Compare lens over the union layout, an Element History tab; `archidocs diff` and `archidocs history build`.
- [Saved View export and selectors](issues/18-saved-view-export.md): Saved Views gain `expand`/`collapse` lists, `upstream`/`downstream: all`, a `{from, to, paths}` path selector and an optional presentation-only `lens`; `archidocs export <view> --format svg|png` (and `--all-saved`) shares the viewer's renderer in Node, PNG via resvg; `build` stays bundle-only; no MCP image tool; new `bad-expand` and `unresolved-path` rules.
- [Viewer build and publishing](issues/19-viewer-build-publishing.md): `archidocs build --out` writes the whole site (viewer, `workspace.bundle.json`, `bundles/`) with hash routing and relative URLs; past Bundles come from a CI cache rebuilt from git, never the live site; keeps the latest 200 Revisions plus tags (`bundle: false` beyond); a GitHub Action and GitLab template, docs for S3-style hosts; `--preview` builds PR sites with Compare against base; opt-in latest-only `views/<id>.svg`.

## Not yet specified

- **Hosted remote MCP:** an always-on MCP endpoint and its sign-in, beyond stdio or a bundle URL.

## Out of scope

- Custom and manual layout. The Model keeps Layout separate so this can be added later.
- Importers (Kubernetes, Terraform, Backstage, OpenTelemetry) and drift detection. v1 is declared-only.
- Hosted SaaS, multi-tenancy, and user sign-in.
- A chat panel inside the viewer; AI is used through MCP from the user's own harness.
- A custom grammar for authoring; v1 uses a structured format.
- Aggregating a Workspace across several repos, including version pinning per Project; v1 is one repo ([Workspace aggregation](issues/07-workspace-aggregation.md)). A later effort.
