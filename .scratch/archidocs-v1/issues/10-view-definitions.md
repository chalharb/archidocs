# View kinds and definitions

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 05, 06
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) leaves `list_views` and `get_view` (a View's query result as nodes and edges) to this ticket.

## Question

How are Views defined? Settle the View kinds (C1 context, C2 Services, C3 Components, Deployment, Dynamic); the query language for structural and Deployment Views (include/exclude rules, depth, filters by Team or tag); how a Dynamic View's steps refer to Relationships; which Views the UI generates automatically vs which are saved in files; and where saved Views live.

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (Generated View, Saved View, Step).

**Generated and Saved Views**
- **Generated Views** exist for every scope without anyone writing them, and are the default way to navigate. **Saved Views** are optional named Views written in YAML. Dynamic Views are always Saved.
- **Generated scopes:**
  - **C1 Landscape:** the whole Workspace.
  - **C2 Landscape:** the whole Workspace with every System collapsed, expanded on demand.
  - **C2 per System:** the System's Services plus their direct neighbours.
  - **C3 per Service:** the Service's Components plus their direct neighbours. Only generated for Services that declare Components.
  - **Deployment per Environment:** every Deployment in that Environment.
- Expand and collapse is viewer state inside one View, not a different View. How it behaves is left to [Viewer UX](14-viewer-ux.md).

**What each kind shows**
- **C1:** Persons and Systems. A Service in no System appears as itself.
- **C2:** Services inside their System as a container, plus Persons.
- **C3:** the Components of one Service.
- **Deployment:** Deployment Targets nested as containers, with Deployments inside them.
- **Dynamic:** the participants named in its Steps, at whatever level each Step uses.
- **Neighbours:** in C1–C3, an Element outside the focus that has a Relationship with the focus is collapsed to the highest level that still separates it. Edges are derived as in [Core domain model](05-core-domain-model.md).
- External Elements render like any other, with the `external` flag shown visually.

**Deployment View edges**
- Edges come from the logical Model. A consumer Deployment connects to the provider Deployments that share its deepest common Deployment Target. If no Target is shared below the Environment, it connects to all of the provider's Deployments in that Environment.
- A related Service with no Deployment in the Environment, such as an External provider, is shown as a plain logical node outside every Target.

**Saved Views: where and how**
- **Location:** under `views:` in any Project's YAML, sub-keyed `structural:` and `dynamic:`. A View may reference Elements in any Project. Workspace-wide Views live in a Project the org chooses, such as `architecture`. `workspace.yaml` stays limited to Teams and Environments.
- **Fields:**
  - `title`, plus optional `description` and `tags`.
  - Each View belongs to its Project, with no Owner override.
  - Its id is a slug unique among that Project's Views, in a namespace separate from Elements.
- **Structural and Deployment query:**
  - **Shape:** structured YAML, not a string mini-language.
  - **`level`:** `c1 | c2 | c3 | deployment`.
  - **`include` and `exclude`:** lists of selectors. A selector is:
    - a bare id (shorthand for the Element itself);
    - `{element, with: [children|descendants], upstream: n, downstream: n}`;
    - `{team}`, or `{tag}`.
  - **Resolution:**
    1. Union the `include` selectors.
    2. Subtract the `exclude` selectors.
    3. Collapse every Element to `level`.
    4. Derive edges.
  - `upstream` and `downstream` follow Relationships, counting a `via` broker as a hop, as `find_paths` does.
  - **Not in v1:** boolean logic, wildcards on ids, and edge selectors.
- **Deployment Views** add a required `environment` and an optional `targets: [ids]` (those Deployment Target subtrees only). `include` and `exclude` select Services, and the View shows their Deployments.

**Dynamic Views**
- **Steps are a flat ordered list,** numbered by position: `{from, to, relationship?, description?, note?, return?}`.
- **Resolving a Step:** `from` + `to` resolve to the Relationship between them. `relationship: <id>` chooses one when the pair has several. A Step may connect higher-level Elements when a derived edge exists between them.
- **Return Steps:** `{from: api, to: web, return: true}` is valid only when the opposite Relationship (web → api) exists, and is drawn dashed.
- **Labels:** `description` defaults to the Relationship's. Interaction (sync/async) always comes from the Relationship.
- **Participants** are ordered by first appearance. An optional `participants: [ids]` list fixes the order.
- **Not in v1:** parallel blocks, loops, alt/opt branches, nested scenarios, and Steps that refer to other Dynamic Views.

**Ids**
- **Saved Views:** `project:view-id`.
- **Generated Views:** `c1`, `c2`, `c2/<system>`, `c3/<service>` and `deployment/<environment>`, for example `c2/shop:checkout`. Saved ids can't contain `/`, so the two kinds never clash.
- The same ids are used in viewer URLs and in MCP.

**Bundle**
- The `views` slot holds Saved View definitions with every id qualified, but not their resolved nodes and edges. Generated Views aren't stored.
- One shared resolver turns definitions into nodes and edges for the viewer, MCP and `check`.

**MCP**
- **`list_views(kind?, element?)`:** returns Generated and Saved Views. With `element`, it returns the Views that contain that Element, including the Dynamic Views it takes part in.
- **`get_view(id)`:**
  - **Structural and Deployment Views:** `{id, kind, title, nodes: [{id, kind, parent, collapsed}], edges: [{from, to, relationships}]}`.
  - **Dynamic Views:** `participants` and `steps: [{n, from, to, relationship, description, note, return, interaction}]`.
- **Shared rules:** both tools take the reserved `at` and follow the usual `limit`, `truncated` and error rules. `get_element` gains `dynamicViews`.
- **Write tools:** `upsert_view(project, id, definition)` and `remove_view(id)` follow the same rules as the other write tools:
  - `definition` has the YAML structure and is checked against the same zod schema.
  - A new View goes into `model.yaml` unless a `file` argument is given.
  - `remove_view` is refused while an ADR links to the View.

**`check`**
- **Errors:**
  - unknown ids in a View
  - missing or ambiguous Steps
  - a return Step with no opposite Relationship
  - ancestor and descendant together as participants
  - a `targets` entry outside the View's `environment`
- **Warnings:**
  - a Saved View that resolves to no nodes
  - a View over 150 nodes
- Rule ids are left to [archidocs check](16-archidocs-check.md).

**Not decided here**
- Custom and manual layout of Saved Views (out of scope). Saved Views carry no positions.
- Whether ADRs can link Views, and in which field, is left to [ADR format and linking](11-adr-format.md).
