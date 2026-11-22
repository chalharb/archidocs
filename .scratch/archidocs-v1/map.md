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

## Not yet specified

- **Viewer build and hosting:** how the static viewer is built from a Workspace Bundle in CI and published.
- **Search and Element pages:** finding Elements by name, owner or URL in the viewer; a detail page per Element (owner, Deployments, URLs, ADRs).
- **Hosted remote MCP:** an always-on MCP endpoint and its sign-in, beyond stdio or a bundle URL.

## Out of scope

- Custom and manual layout. The Model keeps Layout separate so this can be added later.
- Importers (Kubernetes, Terraform, Backstage, OpenTelemetry) and drift detection. v1 is declared-only.
- Hosted SaaS, multi-tenancy, and user sign-in.
- A chat panel inside the viewer; AI is used through MCP from the user's own harness.
- A custom grammar for authoring; v1 uses a structured format.
- Aggregating a Workspace across several repos, including version pinning per Project; v1 is one repo ([Workspace aggregation](issues/07-workspace-aggregation.md)). A later effort.
