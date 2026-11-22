# Archidocs v1

Status: ready-for-agent
Map: [Archidocs v1](map.md)

Synthesised from the 19 resolved tickets in [issues/](issues/). Terms follow [GLOSSARY.md](../../GLOSSARY.md). Where this spec and a ticket's Answer differ, the later amendment noted in the ticket wins; the spec already applies every amendment.

## Problem Statement

People across an engineering organisation keep asking the same architecture questions and can't get trustworthy answers in one place:

- An Enterprise Architect can't see how two Services are connected without asking several Teams.
- A Solutions Architect can't tell where a Service is deployed.
- A Developer can't list what their Team owns.
- A Product Owner can't see what is upstream and downstream of an outage.
- A QA Tester can't find a Service's URL in a given Environment.
- Technical staff can't find the decisions (ADRs) behind an Element, propose new ones in the same place, or see how the system changed over time.

Existing tools each cover part of this. None has first-class ownership, a URL per Environment, transitive impact queries and a multi-Team model together. Diagrams drawn by hand go stale because they aren't the source of truth. AI agents, now doing much of the reading and writing, have no structured, validated way to query or edit the architecture.

## Solution

Archidocs is an open-source, self-hosted, git-native architecture-as-code tool, written in TypeScript. It ships as a CLI, a static viewer and an MCP server.

- **One Workspace repo.** Each Team declares its slice of the architecture as YAML files in its own Project folder. The repo also holds Workspace-wide Teams and Environments.
- **One Model.** Archidocs combines every Project into one validated Model: Persons, Systems, Services and Components, Relationships, Deployment Targets and Deployments with URLs. It is linked to ADRs written as markdown beside it.
- **One validator.** `archidocs check` reports every error in one pass, with file:line and did-you-mean, for people, CI and agents alike.
- **One Bundle.** `archidocs build` turns the Workspace at a commit into a Workspace Bundle and a static viewer site, published from CI with past Revisions for history.
- **The viewer** answers each persona question as a Lens over Generated or Saved Views: C1, C2, C3, Deployment and Dynamic. Layout is automatic, and diagrams export to SVG or PNG.
- **The MCP server** answers the same questions through specific, stateless read tools. It lets agents edit the Model through validated, comment-preserving write tools that never commit.
- **An authoring skill,** served through MCP, guides any agent harness through bootstrapping a Project from code, adding Services, Relationships, Deployments and Views, and proposing ADRs.
- **History** is the repo's git history. Any two Revisions can be compared as a list of Changes in the CLI, through MCP and in the viewer.

**Acceptance:** each of the six persona questions can be answered both through MCP and in the viewer.

## User Stories

### Workspace setup and authoring

1. As a platform engineer, I want `archidocs init` to scaffold a Workspace root with `workspace.yaml`, so that my org can start declaring architecture in an existing repo.
2. As a platform engineer, I want to define Teams once in `workspace.yaml`, with id, name, description and links, so that ownership means the same thing in every Project.
3. As a platform engineer, I want to define Environments once in `workspace.yaml`, so that "prod" and "staging" mean the same thing in every Project.
4. As a Team lead, I want to create a Project by adding a folder with a `project.yaml` (id, name, owner), so that my Team's slice is discovered automatically without editing a central list.
5. As a Team lead, I want to split my Project across as many YAML files and subfolders as I like, so that large Projects stay readable.
6. As an author, I want to nest Systems › Services › Components as a tree in YAML, so that the file reads like the architecture.
7. As an author, I want to attach a Service or Component to a parent declared in another file with `in:`, so that a subtree can live in its own file.
8. As an author, I want to give each Element a short slug id that doesn't change when I re-parent it, so that links and history survive moves.
9. As an author, I want to declare a Service's `type` (`app`, `datastore` or `broker`) and `technology`, so that readers know what it is.
10. As an author, I want to mark a System or Service as External, so that third-party dependencies like a payment provider are visible and owned by the Team accountable for the integration.
11. As an author, I want to give any Element a description, tags and labelled links, so that readers can find docs, dashboards and runbooks.
12. As an author, I want every Element to default to my Project's Owner and be overridable per Element, so that shared Projects can show mixed ownership.
13. As an author, I want to declare Relationships under their consumer, with description, technology, interaction (sync or async) and tags, so that dependencies live next to the code that has them.
14. As an author, I want to declare a Relationship at the lowest level I know (Component or Service), so that edges between Systems are derived and never drift.
15. As an author, I want to declare several Relationships between one pair of Elements, each with an optional id, so that distinct interactions stay distinct.
16. As an author, I want to model an event subscription as an async Relationship from subscriber to publisher, with `via` (the broker Service) and `channel` (topic or queue), so that topics never have to become Elements.
17. As an author, I want to reference an Element in another Project as `project:id`, so that cross-Team dependencies are explicit and unambiguous.
18. As an author, I want to declare Deployment Targets that nest to any depth (region › cluster › namespace), each with a kind and an Owner, so that I can describe where things run.
19. As an author, I want to reference a Deployment Target declared in another Project, so that a shared platform's clusters are declared once.
20. As an author, I want to declare a Deployment as a Service in an Environment on a Deployment Target, with a main `url` and named `endpoints`, so that URLs are recorded per Environment.
21. As an author, I want editor autocomplete and inline errors from a JSON Schema, so that I write valid YAML first time.
22. As an author, I want to write Saved Views under `views:` in my Project's YAML, so that the diagrams I curate are versioned with the Model.

### Validation (`archidocs check`)

23. As an author, I want `archidocs check` to report every schema and reference error in the whole Workspace in one pass, so that I fix them all at once.
24. As an author, I want each issue to carry file, line, column, rule id, severity and a message with a did-you-mean suggestion, so that I can jump straight to the fix.
25. As an author, I want a YAML syntax error in one file to be an issue rather than a crash, so that I still see the problems in every other file.
26. As an author, I want an Element whose declaration fails the schema to still register its id, so that I'm shown only the root cause and not a cascade.
27. As a CI maintainer, I want `--format github` output, so that issues appear as inline PR annotations.
28. As a CI maintainer, I want `--format json`, so that other tools can consume issues.
29. As a CI maintainer, I want exit code 0 for no errors, 1 for errors (or warnings with `--strict`) and 2 when check couldn't run, so that pipelines gate correctly.
30. As an author, I want stable, documented kebab-case rule ids, with a catalogue of examples and fixes, so that I (and agents) can look up what a rule means.
31. As an author, I want Views that resolve to nothing, or to more than 150 nodes, to be warnings rather than errors, so that they don't block merges.

### Persona questions through MCP

32. As an Enterprise Architect using an agent, I want `find_paths(from, to)` to return the direct declared and derived Relationships both ways and the shortest paths up to a hop limit, so that I can see how two Services are connected.
33. As a Solutions Architect using an agent, I want `get_deployments(service, environment?)` to return each Deployment's Environment, full Deployment Target chain, URL and endpoints, so that I know where a Service runs.
34. As a QA Tester using an agent, I want to find a Service's URL in an Environment from `get_deployments`, and to find a Service from a URL with `search_elements`, so that I can test the right thing.
35. As a Developer using an agent, I want `list_owned(team)` to list the Elements and Deployment Targets my Team owns, with counts of Upstream and Downstream Teams, so that I know my scope and my neighbours.
36. As a Product Owner using an agent, I want `get_impact(id, direction)` to return the transitive upstream or downstream set grouped by distance, with each Element's Owner and the Relationships that carry the impact, so that I can see who an outage affects.
37. As a technical user with an agent, I want `list_adrs(element)` to return the ADRs linked to an Element or its descendants, newest first, with superseded ones marked, so that I understand the decisions behind it.
38. As an agent, I want `get_element(id)` to return an Element's fields, Owner, parent and children, Relationships in and out, derived edges, Deployments with URLs, ADRs, Dynamic Views, source location and viewer link, so that I can answer follow-up questions without more calls.
39. As an agent, I want `search_elements` to match names, ids and URLs, so that I can resolve what a user means to a qualified id.
40. As an agent, I want `list_teams`, `list_environments` and `get_workspace_info` (source, commit, whether writes are allowed), so that I can orient myself.
41. As an agent, I want `list_views(kind?, element?)` and `get_view(id)` to return Views as nodes and edges (or participants and Steps), with Lens marks, so that I can reason about a diagram without an image.
42. As an agent, I want every result as typed `structuredContent` plus a compact Markdown text copy, so that I work in any MCP client.
43. As an agent, I want every list to take `limit` and report `truncated` and a total, so that large answers stay bounded.
44. As an agent, I want unknown ids to return a typed `not_found` error with did-you-mean suggestions, so that I can recover without guessing.
45. As an agent, I want results to carry `viewerUrl` links when a viewer base URL is configured, so that I can send people straight to the diagram.

### Editing through MCP

46. As an agent, I want write tools for Elements, Relationships, Deployment Targets, Deployments, Teams, Environments, Views, Projects (`create_project`) and ADRs (`propose_adr`), so that I can author the whole Model without hand-editing YAML.
47. As an author, I want every write to edit YAML in place, keeping comments and formatting, so that my files stay mine.
48. As an author, I want every write to be validated against the whole Workspace and refused if it introduces any error, so that agents can't break the Model.
49. As an agent, I want a refused write to return `validation_failed` with the same issue records as `check`, so that I can fix the input.
50. As an agent, I want every write to return the diff and to accept `dry_run`, so that I can show the user before or after changing anything.
51. As an agent, I want a new Element to go into its parent's file, or into a file I name, so that placement is predictable.
52. As an agent, I want an ambiguous Relationship write (several on a pair, no id) to return `ambiguous` with each candidate's file:line, so that I can pick the right one.
53. As an author, I want removals refused while anything (Relationships, Views, ADRs, Deployments) still references the item, with the list of references, so that nothing is deleted by cascade.
54. As an author, I want the MCP server never to commit, push or open PRs, so that git stays under my or my harness's control.
55. As a security-minded user, I want write tools off over HTTP unless I pass `--allow-writes`, and the HTTP server bound to localhost, so that a local server can't be abused.
56. As an agent, I want a `check` tool that validates what is on disk, so that I can verify edits I made with my own file tools.

### MCP sources and transports

57. As a developer, I want `archidocs mcp` in a Workspace checkout to serve the Model built in memory and rebuilt on file change, so that answers match my working tree.
58. As a developer working in a Service's code repo, I want `archidocs mcp --workspace <path>` to point at my local Workspace checkout, so that an agent can read my code and edit the Model together.
59. As a reader without a checkout, I want `archidocs mcp --bundle <url|path>` to serve a published site or Bundle file read-only, re-checked when it changes, so that I can query the latest architecture.
60. As a user of any MCP client, I want stdio and Streamable HTTP transports, so that Archidocs works whichever harness I use.

### Authoring skill

61. As a Team lead, I want `archidocs init` (or `archidocs init --skill` in a code repo) to install a thin skill stub for common harnesses and add a pointer to AGENTS.md, so that my agent knows how to edit the Model.
62. As an agent, I want `get_authoring_guide(topic?)` to return the skill and its topics, matching the schema of the version that serves it, so that guidance never goes stale.
63. As a user without MCP, I want `archidocs guide [topic]` to print the same guidance, so that I can still follow it.
64. As a Team lead, I want an agent to bootstrap my Project from my code repo: it builds an inventory with evidence and confidence, asks only what code can't tell, writes after one approval, then runs `check`, so that onboarding takes minutes.
65. As a Team lead, I want the bootstrap to declare only my Project's outbound Relationships, resolving providers with `search_elements` and reporting unresolved ones as gaps, so that it never writes into other Teams' Projects.
66. As an author, I want guided flows for adding a Service, Relationships, Deployments, a Dynamic View, a Saved View, an ADR, and for renaming, moving or removing things, so that agents edit consistently.
67. As an author, I want every guided flow to end with `check` and a suggested branch name, PR title and body, so that the change is ready to review.

### Views

68. As any viewer user, I want Generated Views for every scope (the C1 Landscape, the C2 Landscape, C2 per System, C3 per Service with Components, and Deployment per Environment), so that I can navigate without anyone drawing diagrams.
69. As an Enterprise Architect, I want the C2 Landscape to start with every System collapsed and to expand on demand, so that the whole org stays readable.
70. As a viewer user, I want neighbours outside a View's focus collapsed to the highest level that still separates them, so that context is shown without clutter.
71. As a Solutions Architect, I want a Deployment View that nests Deployment Targets as containers, groups Deployments by System inside each Target, and draws edges to the nearest provider Deployment, so that I can read the runtime topology.
72. As an author, I want Saved Views defined as structured `include`/`exclude` selectors (an id, an Element with children, descendants, upstream or downstream, a Team, a tag, or a path between two Elements) collapsed to a `level`, so that curated diagrams follow the Model as it changes.
73. As an author, I want `expand` and `collapse` lists on a Saved View, so that some Systems stay open while others stay closed.
74. As an author, I want `upstream`/`downstream: all` in a selector, so that I can save a full impact diagram.
75. As an author, I want a Saved View to carry an optional presentation-only `lens:`, so that it opens with impact, Team or path highlighting.
76. As an author, I want to set a Saved View's `direction` (`TB`, `BT`, `LR` or `RL`), so that it reads the way I intend.
77. As an author, I want Deployment Saved Views with a required `environment` and optional `targets`, so that I can focus on one region or cluster.
78. As an author, I want Workspace-wide Saved Views and ADRs to live in a Project the org chooses, so that `workspace.yaml` stays limited to Teams and Environments.

### Dynamic Views

79. As an author, I want to write a Dynamic View as an ordered list of Steps (`from`, `to`, optional `relationship`, `description`, `note`), each resolved to an existing Relationship, so that scenarios can't invent dependencies.
80. As an author, I want return Steps that are valid only against a sync Relationship the other way, drawn dashed, so that request/response reads naturally.
81. As an author, I want to write an event Step publisher → subscriber, resolved to the reverse `via` subscription, so that I write events the way they travel.
82. As an author, I want ambiguous Steps (several matching Relationships, or both a call and an event) to be errors unless I name the `relationship`, so that a scenario never silently picks the wrong one.
83. As an author, I want Steps between Systems or Services wherever a derived edge exists, so that I can tell a scenario at a high level.
84. As an author, I want participants ordered by first appearance, or fixed by a `participants` list, so that the chart reads left to right as I intend.
85. As a viewer user, I want a Dynamic View screen with a play transport, a numbered Step outline, the sequence chart and a Step detail panel, so that I can walk through a scenario.
86. As a viewer user, I want each Step's detail to link to the Generated Views containing its Relationship, most specific first, so that I can jump from a scenario to the structure.
87. As a viewer user, I want a "Show brokers" toggle that splits event Steps into publish and deliver legs, so that I can see the broker when I need to.
88. As a viewer user, I want a Sequence | Graph toggle that shows the same Steps as a numbered graph, so that I can see the scenario's shape.
89. As a viewer user, I want keyboard control (Space to play, J/K to step, Esc to clear), so that I can present a scenario smoothly.

### Viewer

90. As a viewer user, I want a rail with Find, collapsible Model and Views trees (by kind or by Team) and a Teams list, so that I can get anywhere quickly.
91. As a viewer user, I want the URL to hold the whole screen (View, open boxes, Lens, selection, picks, direction, `at`, `vs`), so that back, forward, Recent and Copy link reopen exactly what I saw.
92. As a viewer user, I want breadcrumbs up the scope ladder and chips for open boxes, Lens and picks, so that I never lose my place.
93. As a viewer user, I want an Element panel on selection with Overview, URLs, ADRs, Links and History tabs, so that I see everything about an Element in one place.
94. As a Product Owner, I want an Impact Lens with distance badges over any View, so that I can see an outage's blast radius in context.
95. As an Enterprise Architect, I want a "Connect to…" Lens that lights the shortest paths, or all paths up to 4 hops, between two nodes, so that I can see how they're connected.
96. As a Developer, I want a Team Lens that rings owned nodes, so that I can see my Team's footprint on any View.
97. As a Solutions Architect, I want "Where is it deployed?" to open the Environment's Deployment View with that Service's Deployments marked, so that I can find its runtime location.
98. As a QA Tester, I want the URLs tab to list URLs per Environment and Deployment Target with copy buttons, and Find to match URLs, so that I get the right URL fast.
99. As a viewer user, I want expand/collapse, double-click to open a box's own View, and Focus from Find that stays in the current View when it can, so that navigation feels continuous.
100. As a viewer user, I want nodes to animate to new positions on layout changes (up to 100 nodes, and never with reduced motion), so that I can follow what moved.
101. As a viewer user, I want a direction toggle per View, so that I can redraw a diagram the way I read it.
102. As a viewer user, I want Team colours as a stripe always paired with the Team code, so that ownership doesn't rely on colour alone.
103. As a viewer user, I want to pick nodes (with shift-click or a path) and export the whole View or the picks as SVG or PNG with a title, commit and key, so that I can paste diagrams into docs.
104. As a viewer user, I want "Save as View" to turn my screen into Saved View YAML and the matching `upsert_view` call, so that I can keep what I built.
105. As a viewer user, I want an ADR reader that shows status, effective status, links and the body, so that I can read decisions in context.

### ADRs

106. As a technical user, I want ADRs as MADR-style markdown in each Project's `adr/` folder, numbered per Project as `project:NNNN`, so that decisions live with the Model in git.
107. As a technical user, I want an ADR's frontmatter to link Elements, Deployment Targets and Saved Views, so that decisions show up where they apply.
108. As a technical user, I want to propose an ADR by opening a PR with `status: proposed`, and accept it by setting `accepted` before merging, so that review happens where code review happens.
109. As an agent, I want `propose_adr` to take the next free number, fill the Workspace or Project template, check its links and write a Proposed ADR, so that proposing is one call.
110. As a technical user, I want `supersedes` declared once on the new ADR and `supersededBy` derived, so that I never edit the old file.
111. As a technical user, I want `check` to catch bad frontmatter, missing titles, bad filenames, duplicate numbers, unknown links, hand-written `superseded` and `supersedes` cycles, so that the ADR log stays consistent.
112. As an org, I want to override the ADR template for the Workspace or per Project, so that ADRs follow our house format.

### History

113. As a technical user, I want to view the whole viewer at a past Revision (a ref or a date), so that I can see what the architecture looked like then.
114. As a technical user, I want a Compare Lens between two Revisions over the union layout, with added, removed and changed marks and a Changes list, so that I can see what changed in context.
115. As a technical user, I want an Element's History tab to list the Revisions that changed it or its descendants, so that I can trace its evolution.
116. As an agent, I want `at` on every read tool, plus `get_changes(from, to, scope, kinds)` and `list_history(scope, since, until)`, so that I can answer "what changed?" questions.
117. As a reviewer, I want `archidocs diff origin/main HEAD --format markdown` in CI, so that a PR comment shows a Model change's or Proposed ADR's effect.
118. As a CI maintainer, I want `archidocs history build` to backfill past Bundles idempotently, so that turning on publishing gives a full timeline at once.
119. As a developer on a checkout, I want past Bundles built on demand from git and cached locally, so that history works offline without CI.
120. As a reader, I want Bundles from an older schema rebuilt or migrated before comparing, so that diffs across upgrades are correct.

### Building, exporting and publishing

121. As a CI maintainer, I want `archidocs build --out <dir>` to write a complete static site (the prebuilt viewer, the latest Bundle, past Bundles and the Revision index), so that any static host can serve it.
122. As a CI maintainer, I want `--bundle-only`, so that I can produce just the Bundle for other consumers.
123. As a CI maintainer, I want hash routing and relative URLs, so that the site works under any base path with no server rewrites.
124. As a CI maintainer, I want past Bundles kept for the latest 200 Revisions plus every tag by default (`--keep <n|all>`), so that the site fits within Pages size caps.
125. As a CI maintainer, I want past Bundles rebuilt from git and a CI cache rather than fetched from the live site, so that a lost cache or a host move costs only build time.
126. As a CI maintainer, I want a reusable GitHub Action and a GitLab CI template that check, build and deploy to Pages on every default-branch push and tag, so that publishing is a few lines of config.
127. As a CI maintainer, I want a failed check to publish nothing, so that the last good site stays up.
128. As a reviewer, I want `archidocs build --preview` to build a PR site with Compare "base → PR" applied, so that I can review an architecture change visually.
129. As a docs author, I want `archidocs export <view> --format svg|png` (and `--all-saved`) to render any View, byte-identical for the same View at the same commit, so that committed diagrams only change when the architecture does.
130. As a docs author, I want an opt-in `images` input on the CI integrations that publishes stable `views/<id>.svg` URLs, so that wikis and READMEs always show the latest diagram.
131. As a CI maintainer, I want exported PNGs to embed a bundled font, so that output doesn't depend on fonts installed on the runner.

## Implementation Decisions

### Product shape and stack

- TypeScript throughout. Node for the CLI and MCP server; React with React Flow 12.12.x for the viewer; elkjs 0.12.1 (pinned; 0.13.0 is deprecated) for layout, in a web worker in the browser.
- One npm package exposes the `archidocs` CLI, ships the prebuilt viewer assets and contains the MCP server. Internally it is split into the modules below.
- Archidocs wraps none of LikeC4, Structurizr, Backstage or IcePanel and doesn't depend on them.

### Modules

Each is a deep module with a small interface. The core engine is the main seam; every other module is a thin adapter over it.

1. **Schema.** zod types are the single source for Project YAML, `workspace.yaml`, `project.yaml`, ADR frontmatter, Saved View definitions, the Workspace Bundle and MCP tool inputs. JSON Schema is generated from them for editors (via the `yaml-language-server` `$schema` comment) and for MCP.
2. **Core engine** (the main seam). Its interface, in outline:
   - **Load:** take a Workspace root on a file-system abstraction and return `{bundle, issues}`. This covers discovery, parsing YAML with source positions, merging Project files, resolving references and running validation.
   - **Query:** run against a Bundle: derived edges, `findPaths`, `getImpact`, `listOwned`, `getDeployments`, `search`, `getElement`, `listAdrs`, `resolveView` (Generated, Saved and Dynamic, including Lens marks) and `diff`.
   - **Shared:** `check`, `build`, MCP and the viewer all call these same functions; there is no second implementation.
3. **Validator.** A registry of rule definitions: id, severity, a check function, a failing example and the fix. It generates the rule catalogue for the docs and `get_authoring_guide`. It is part of the core engine's Load.
4. **YAML writer.** Comment- and format-preserving edits to the Model's YAML files: upsert or remove an item, place it in its parent's file or a named file, and return a unified diff. Every edit is applied to an in-memory overlay and re-validated through the core engine before anything is written to disk.
5. **ADR reader and template filler.** Parses frontmatter and the `# ` title, derives `supersededBy` and the effective status, and fills `{{title}}`, `{{date}}`, `{{elements}}` and `{{views}}` from the Project, Workspace or default MADR-minimal template.
6. **History.** Reads files at a commit through `git show` without a worktree, builds the list of Revisions (first-parent commits on the default branch that touched the Workspace root), builds and caches past Bundles, writes the Revision index with changed ids, and runs versioned Bundle migrations.
7. **Layout.** Structural layout: elkjs `layered` with `ORTHOGONAL` routing, `hierarchyHandling: SEPARATE_CHILDREN`, edges cut at container-border ports, children and edges sorted by id, `BRANDES_KOEPF` node placement, and fixed node sizes per kind. Sequence layout: a pure function with one row per Step, columns in participant order, and x positions from one longest-path pass over lower-bound gaps.
8. **Renderer.** A pure function from a resolved View plus layout to SVG (title, source line, key, Lens highlighting, labels cut to length, one embedded font); PNG through resvg (wasm). It is shared by the viewer's Export and `archidocs export`.
9. **MCP server.** Built on MCP TypeScript SDK v2 (≥ 2.4.0) with stateless tools only, over stdio or Streamable HTTP. A source adapter is either a checkout (with file watching) or a Bundle URL or path (re-checking `index.json` at most every 60 s, with conditional requests).
10. **CLI.** `init [--skill]`, `check`, `build [--out] [--bundle-only] [--keep] [--preview]`, `mcp [--workspace] [--bundle] [--http] [--allow-writes]`, `guide [topic]`, `export`, `diff` and `history build`.
11. **Viewer.** A static React app reading `workspace.bundle.json`, `bundles/index.json` and `bundles/<sha>.json` by relative URL. All screen state is in a hash-routed URL.
12. **Authoring guide content.** `SKILL.md` plus one reference file per topic, served by `get_authoring_guide` and `archidocs guide`, and the thin stub that `init` installs.
13. **CI integrations.** A reusable GitHub Action and an includable GitLab CI template.

### Domain model

- **Element kinds are fixed:** Person, System, Service and Component.
  - Nesting is strict: System › Service › Component. A Service may sit outside any System. Persons are top-level.
  - Every Element has an id, name, description, Owner, tags and links.
  - Service adds `type` (`app` by default, or `datastore` or `broker`), `technology` and `external`. System adds `external`. Component adds `technology`.
  - An External Element can't contain declared Components.
- **Relationships** are stored only as declared, by consumer → provider, with description, technology, interaction (`sync` by default, or `async`), tags, an optional id, and optional `via` (which must be a broker Service) and `channel` (async only).
  - Derived edges are computed at query time and carry the Relationships beneath them.
  - A Person can't be a provider. A Relationship can't link an Element to itself, its ancestor or its descendant.
  - Impact and path queries count a `via` broker as a hop and as a dependency of both sides.
- **Ownership:** exactly one Owner Team per Element, defaulting to the Project's Owner.
  - A Relationship belongs to its consumer's Owner, and a Deployment to its Service's Owner.
  - Deployment Targets have their own Owner. Teams are flat and have no members.
- **Deployment Targets** nest to any depth, aren't Elements, and share the Element id namespace within a Project.
- **Deployments** are identified by their (Service, Environment, Target) triple and carry `url` and named `endpoints`. URLs live only on Deployments.
- **Ids:**
  - Element and Target ids are author-chosen slugs, unique per Project.
  - Qualified ids (`project:id`) are canonical in the Bundle and in MCP. A Project may not prefix its own ids.
  - Teams and Environments use bare ids everywhere.
  - Saved View ids are `project:view-id` and ADR ids are `project:NNNN`, each in its own namespace.
  - Generated View ids are `c1`, `c2`, `c2/<system>`, `c3/<service>` and `deployment/<env>`.

### Workspace on disk

- **Workspace root:** the folder holding `workspace.yaml` (by default `archidocs/` at the repo root), found by walking up from the current folder. `teams` and `environments` may appear only there.
- **Projects:** any folder below the root with a `project.yaml`. Every `*.yaml` beneath it belongs to that Project. Each Element is declared exactly once, and files never deep-merge.
- **Discovery errors:** a nested Project, a model file outside every Project, or a duplicate Project id.
- **ADRs:** in `<project>/adr/NNNN-slug.md`, with `template.md` excluded. The Workspace template is `adr-template.md` beside `workspace.yaml`.
- **Local history cache:** `.archidocs/cache/`, gitignored.

### Workspace Bundle contract

- **Shape:** one JSON file checked against the zod-generated schema, with keys in a fixed order.
  - **Header:** `schemaVersion`, `commit` and `builtAt`.
  - **Definitions:** `teams` and `environments`.
  - **Projects:** `projects` with id, name, owner and folder.
  - **Model:** a flat `elements` list (qualified id, kind, parent and fields); declared `relationships`; `targets`; and `deployments`.
  - **Views:** Saved View definitions with every id qualified; not their resolved nodes.
  - **ADRs:** metadata, links, `supersedes`/`supersededBy`, effective status and the full body.
  - **Source:** every item carries `source: {file, line}`.
- **Not stored:** derived edges, Generated Views and Layout.
- **Building:** `archidocs build` refuses to write a Bundle if there is any error.

### Validation contract

- **Issue record:** `{file, line, column?, rule, severity: error|warning, message}`.
  - `file` is relative to the repo root.
  - Issues are sorted by file, then line, then rule.
  - An issue involving two places is reported once, at the later path.
- **Rule ids:** the catalogue in [archidocs check](issues/16-archidocs-check.md), plus the ADR rules from [ADR format and linking](issues/11-adr-format.md) and `return-on-async`, `bad-expand` and `unresolved-path`.
  - Warnings: `empty-view`, `oversized-view` and `unresolved-path`, plus the two ADR `supersedes` warnings.
  - Ids are stable once shipped and never reused.
- **Not configurable in v1:** no rule config and no suppression comments.

### Views

- **Resolution order for structural and Deployment Saved Views:**
  1. Union the `include` selectors.
  2. Subtract the `exclude` selectors.
  3. Collapse every Element to `level`.
  4. Apply `expand` and `collapse`.
  5. Derive edges.
- **Selectors:** a bare id; `{element, with: children|descendants, upstream: n|all, downstream: n|all}`; `{team}`; `{tag}`; `{from, to, paths: shortest|n}`.
- **Lens:** `{impact, direction}`, `{team}` or `{path}`. It never changes membership.
- **Deployment Views:**
  - Saved ones need `environment` and accept optional `targets`.
  - A consumer Deployment connects to provider Deployments under their deepest shared Target, or to all of the provider's Deployments in that Environment when no Target is shared.
  - A related Service with no Deployment in the Environment is shown as a logical node outside every Target.
  - Inside each Target, Deployments are drawn in a System box (drawing only).
- **Direction defaults:** `LR` for C1 and C2, `TB` for Deployment Views.
- **Dynamic View Step resolution:**
  - A non-return Step collects forward Relationships without `via` and reverse `via` subscriptions. Exactly one match is the Step; otherwise it is `ambiguous-step` unless `relationship` is given.
  - A return Step needs an opposite sync Relationship.
  - Derived-level Steps are allowed.
  - An event Step's default label is the `channel`.
  - Not in v1: parallel blocks, loops, alt/opt branches, or nesting.
- **`get_view` output:**
  - **Structural and Deployment Views:** `{id, kind, title, lens?, nodes: [{id, kind, parent, collapsed, mark?}], edges: [{from, to, relationships, lit?}]}`.
  - **Dynamic Views:** `participants` and `steps: [{n, kind: call|return|event, from, to, relationship, interaction, via?, channel?, description, note?}]`. MCP never returns broker legs.

### MCP contract

- **Read tools:** `get_workspace_info`, `search_elements`, `get_element`, `find_paths`, `get_impact`, `list_owned`, `get_deployments`, `list_teams`, `list_environments`, `list_views`, `get_view`, `list_adrs`, `get_adr`, `get_changes`, `list_history` and `get_authoring_guide`.
  - Every read tool takes `at` (a ref or a date).
  - Lists take `limit` (default 50) and return `truncated` and a total.
- **Write tools** (checkout only): `create_project`, `upsert_element`, `remove_element`, `upsert_relationship`, `remove_relationship`, `upsert_target`, `remove_target`, `upsert_deployment`, `remove_deployment`, `upsert_team`, `upsert_environment`, `upsert_view`, `remove_view`, `propose_adr` and `check`.
  - All take `dry_run`, never take `at`, return a diff, and refuse on any error.
  - They take a `project` argument and accept bare ids inside it.
- **Errors:** a tool result with `isError: true` and `{code, message, suggestions?, issues?}`.
  - `code` is one of `not_found`, `ambiguous`, `invalid_input`, `validation_failed`, `read_only`, `source_unavailable` or `history_unavailable`.
  - Protocol errors are only for malformed calls.
- **Not in v1:** an image or export tool, Sampling, Roots, or client-specific features.

### History contract

- **Points in time:** a point is a ref or a date. A date resolves to the last first-parent default-branch commit at or before it.
- **Published layout:** `bundles/<sha>.json` (immutable) and `bundles/index.json`. Each index entry is `{sha, date, subject, author, tags, counts, changedIds, bundle}`, where `bundle: false` marks a dropped Bundle.
- **Diffs:** a flat list of Changes (`added`, `removed` or `changed`, with before and after per field).
  - Matching: by id, or by qualified id; Deployments by their triple. Relationships by id, else by a unique pair, else by (pair, technology, interaction).
  - Owner is compared as the effective Owner.
  - `source`, key order, `builtAt` and derived edges are ignored.
  - There is no rename detection.
- **Older schemas:** Bundles with different `schemaVersion`s are never compared raw. A checkout rebuilds the older one with the current Archidocs; a Bundle URL reader migrates it in memory or returns `history_unavailable`.

### Viewer behaviour

- **Shell:** variant D, "Explorer, focused" ([Viewer UX](issues/14-viewer-ux.md)).
- **History entries:** changing the View, Lens, open boxes, `at` or `vs` pushes a browser history entry; selection and picks replace the current one.
- **Dynamic View screen:** variant D from [Sequence chart prototype](issues/13-sequence-chart-prototype.md).
  - Playback advances about every 1.4 s.
  - Arrows: sync is solid with a filled head, async is solid with an open head, and return is dashed with an open head.
  - Headers stay pinned, and the zoom never drops below 85%.
- **Display defaults:**
  - Sub-labels and Team codes hide below 45% zoom.
  - The Team colour palette is generated in OKLCH using golden-angle hues.

### Publishing

- **What publishes:** CI publishes on default-branch pushes and tags, gated on `check`.
- **Past Bundles:** restored from a CI cache keyed by `schemaVersion` and rebuilt from a full clone. Nothing is ever fetched from the live site.
- **Recommended cache headers:** `immutable` for `bundles/<sha>.json`; `no-cache` for `index.json` and `workspace.bundle.json`.
- **PR previews:** `--preview` builds the PR head plus the base's latest Revision, read from `origin/<base>` and never fetched. Archidocs hosts nothing and posts no PR comments.

## Testing Decisions

- **What makes a good test:** it drives a public interface with realistic input (a fixture Workspace as files in a temp git repo) and asserts on externally visible output: Bundle content, issue records, query results, tool results, CLI exit codes and stdout, written files, rendered SVG and what is on screen. Tests never reach into internal modules, private helpers or the YAML library's AST.
- **Seams, agreed with the user:**
  1. **Core engine (main seam).** Fixture Workspace folder in → `{bundle, issues}` out, plus every query function over a Bundle.
     - Most behaviour is tested here: discovery, references, ownership defaults, derived edges, `findPaths`, `getImpact`, `listOwned`, Deployment edges, View resolution (selectors, expand/collapse, Lens marks, Step resolution including events and ambiguity), ADR derivation, and `diff` matching.
     - Every check rule gets at least one failing fixture (the catalogue's own failing example) and one passing fixture.
     - Bundles at the same commit must be byte-stable.
  2. **MCP.** An in-memory MCP client against the server, over a fixture checkout and over a fixture Bundle site.
     - Covers tool schemas, `structuredContent` and text output, `limit`/`truncated`, typed errors and the `read_only` behaviour of HTTP and Bundle sources.
     - Covers write tools end to end: comment preservation (assert on file text before and after), refusal with issues, `dry_run`, `ambiguous`, refused removals and the placement rules.
     - Covers `at` and `history_unavailable`.
     - Includes one test per persona question, as the acceptance tests.
  3. **CLI.** The real binary run against temp git repos with scripted commits.
     - Covers exit codes 0/1/2, `--strict`, the three `--format` outputs, the `build --out` site layout and retention (`--keep`, tags, `bundle: false`), `history build` idempotence, `diff` formats, `--preview`, and the files `init` writes.
  4. **Renderer.** A resolved View in → golden SVG files. It must be byte-identical across runs, so check this on two OS runners in CI. PNG is checked by its dimensions and a decode, not by exact pixels.
  5. **Viewer.** Playwright against a site produced by `archidocs build --out` from a fixture Workspace.
     - Covers that each persona question can be answered: URL round-trips (Copy link and back/forward restore the screen), Lenses, Compare, Save as View output, Export, and the Dynamic View transport and keyboard.
     - Layout rules are asserted on rendered geometry: no overlaps, no edges through nodes, right-angled segments.
- **Layout** is tested through the core engine and renderer seams: the auto-layout definition holds, and adding one Service to a fixture moves no node inside an untouched System.
- **Performance budgets** are checked against a generated Workspace at the scale target (about 50 Projects, 1,000 Elements and 3,000 Relationships). Budgets: C2 at about 150 nodes laid out in about 125 ms or less in a worker; a Deployment View in about 450 ms or less; a full `check` well under a few seconds. They are treated as tracked metrics, not flaky hard gates.
- **Prior art:** there is no production code or tests yet. The throwaway prototype branches (`prototype/06-authoring-format`, `prototype/09-auto-layout`, `prototype/13-sequence-chart` and `prototype/14-viewer-ux`) contain the sample Workspaces, the seeded-error checker, the layout rule checks and the SVG export. Reuse their fixtures and assertions as the starting test data, not their code.

## Out of Scope

- Custom and manual layout; Saved Views carry no positions.
- Importers (Kubernetes, Terraform, Backstage, OpenTelemetry) and drift detection. The bootstrap is one-shot agent guidance with no parsers.
- Hosted SaaS, multi-tenancy and user sign-in.
- Hosted remote MCP, meaning an always-on shared endpoint with auth. v1 is stdio or localhost HTTP only.
- A chat panel in the viewer.
- A custom authoring grammar, and TypeScript authoring.
- Workspaces spanning several repos, and per-Project version pinning.
- User-defined Element kinds, sub-Teams, Team members, lifecycle status, free-form metadata, and deployment-only Relationships.
- Links from ADRs to Relationships; ADR write tools beyond `propose_adr`.
- Boolean logic, id wildcards and edge selectors in View queries; per-selector `level`.
- Parallel blocks, loops, branches, nested scenarios and cross-View references in Dynamic Views.
- Impact per Environment.
- Rename detection in diffs.
- Configurable or suppressible check rules, lint-style coverage warnings, SARIF and `--explain`.
- MCP image or export tools; a dark theme for exports; `--only` and `--lens` on export.
- Box-select (drag) picking in the viewer.
- Preview hosting and posting PR comments.

## Further Notes

- **Real-Workspace performance is unproven.** Every layout measurement came from synthetic Workspaces. Recheck the engine choice and the animation threshold when the first real Workspace exists. libavoid is the documented fallback for edge routing.
- **ELK limits.** Its model-order options throw on nested graphs in 0.12.1, so stability relies on sorting by id and laying out each container separately.
- **ADRs read raw on GitHub** keep showing `accepted` after they're superseded. This trade-off was accepted.
- **MCP client coverage of `structuredContent`** is mostly undocumented. The Markdown text copy is what makes results usable everywhere.
- **Suggested build order** for splitting into tickets:
  1. Schema and the core engine (load, validate, Bundle).
  2. `check` and `build --bundle-only`.
  3. The MCP read tools.
  4. The YAML writer and MCP write tools.
  5. Views and the resolver.
  6. Layout, the renderer and `export`.
  7. The viewer shell and Lenses.
  8. The Dynamic View screen.
  9. ADRs.
  10. History (CLI and MCP, then the viewer).
  11. Site build, publishing and the CI integrations.
  12. The authoring guide and `init`.
- Source decisions: every ticket under [issues/](issues/) and the research under [research/](research/). The map is [map.md](map.md).
