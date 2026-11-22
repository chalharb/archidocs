# How existing tools model architecture

Research for [issue 01](../issues/01-prior-art-modelling.md). Sources were read on 2026-11-21. LikeC4 facts come from the docs sources in the [likec4/likec4](https://github.com/likec4/likec4) repo (`apps/docs/src/content/docs/…`, `main` branch) and from its source code. Structurizr facts come from [docs.structurizr.com](https://docs.structurizr.com/dsl/language) and the [structurizr/java](https://github.com/structurizr/java) source. Terms in **bold** follow [GLOSSARY.md](../../../GLOSSARY.md). Each tool's own terms are in `code`.

## Short answer

- **Only two of the five tools model the whole domain: LikeC4 and Structurizr.** Both have a logical model, a separate deployment model built from `instanceOf`, query-based views, and dynamic views. Backstage, IcePanel and Ilograph each lack at least one of Deployments, query-based Views, or a single Relationship store.
- **None of them answers all six persona questions well.** These gaps recur:
  - **Ownership** is first-class only in Backstage (a required field) and IcePanel (on paid plans). LikeC4, Structurizr and Ilograph have no owner field.
  - **URLs per Environment** have no typed home anywhere. The closest is Structurizr's `url` on `containerInstance`.
  - **Transitive upstream and downstream** is not a built-in query in any tool's view language. Every tool shows one hop at a time.
  - **Architecture across many repos** is weak everywhere except Backstage. LikeC4's cross-project `import` needs every project loaded in one workspace.
- **Three design choices separate the tools:**
  - Fixed C4 levels (Structurizr, IcePanel) versus user-defined kinds (LikeC4).
  - Implied relationships stored in the model (Structurizr) versus derived when a view is built (LikeC4).
  - Dynamic-view steps that must match model Relationships (Structurizr, IcePanel) versus steps defined freely in the view (LikeC4, Ilograph).
- **Evidence on LLMs authoring YAML vs TypeScript vs a custom grammar is thin.** No study compares them head to head for architecture models. The indirect evidence says:
  - Frontier models produce valid YAML and JSON almost always.
  - Custom DSLs need the grammar in the prompt.
  - Type checking catches most TypeScript errors.
  - The main failure in LLM-written architecture is **invented relationships, not syntax**.

## Per-tool models

### LikeC4

- **Elements and nesting:** element kinds are **user-defined** in a `specification` block (`element system`, `element queue {…}`), not fixed C4 levels ([specification.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/specification.mdx)).
  - Any element can nest children, and names are namespaced by parent: `service1.backend.api` is the fully qualified name ([model.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/model.mdx)).
  - Every source file merges into one model. `extend cloud { … }` adds children, tags, links and metadata from another file. The extended element must be named by its fully qualified name ([extend.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/extend.mdx)).
  - Consequence: "C2" or "C3" means nothing to LikeC4. A level is whatever kinds the team defines.
- **Relationships:** written `a -> b 'title'`, or `<->` for bidirectional. A relationship may be nested, and a "sourceless" one (`-> backend`) takes its parent as the source.
  - Optional kinds (`-[async]->`) carry default title, technology, tags and links. Relationships also take description, technology, tags, links, metadata and `navigateTo` (a dynamic view) ([relationships.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/relationships.mdx)).
  - A relationship's identity is (source, target, direction, kind, title). `extend a -> b "title"` matches on that ([extend.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/extend.mdx)).
  - **Higher-level edges are derived when a view is built, not stored.** "Connections represent merged relationships - direct between elements and/or those derived from their nested elements" ([predicates.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/Views/predicates.mdx)).
- **Deployments:** a separate `deployment` block holds a tree of user-defined `deploymentNode` kinds (environment → zone → vm, and so on).
  - `instanceOf backend.api` places a logical element on a node. One element can have several named instances, and an instance can override title, technology and style.
  - Deployment relationships are inherited from the logical model, and you can add deployment-only ones, such as replication between two instances.
  - Nodes take the usual element properties, including `link`. There is **no typed URL or endpoint field** ([Deployment/model.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/Deployment/model.mdx)).
  - Deployment views use the same predicates, with some limits ([Deployment/views.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/Deployment/views.mdx)).
- **Dynamic Views:** `dynamic view x { a -> b 'step'; b <- a 'reply' }`. Steps are "defined only in the view (without polluting the model)". When a step has no title, LikeC4 takes the title from the model.
  - Control-flow blocks (`parallel`, `opt`, `loop`, `alt`/`when`/`else`, `try`/`catch`) are **experimental**.
  - `variant sequence` draws a sequence chart, but "supports only connections with _leaf_ elements".
  - `include` can set the order of participants. `exclude` is not supported ([dynamic.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/Views/dynamic.mdx)).
- **View definitions:** `view of X` scopes a view to an element and makes it that element's default view. `extends` reuses another view ([Views/index](https://likec4.dev/dsl/views/)). Predicates **apply in order**:
  - `include x`, `x.*` (children), `x.**` (descendants that have relationships), `x._` (expand)
  - `-> x` and `x ->` (incoming and outgoing from elements already shown), `a -> b`, `a <-> b`
  - `exclude`, which only removes what was included earlier
  - `where` filters on kind, tag, metadata, `source.*` and `target.*`, with `and`, `or` and `not`
  - `with { … }` overrides properties for one view ([predicates.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/Views/predicates.mdx))
- **Ownership:** none built in. The docs' own examples use metadata (`maintainer 'Platform Team'`) and tags (`#team1`) ([model.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/model.mdx), [relationships.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/relationships.mdx)).
- **Layout:** Graphviz auto-layout, with `routing ortho` for right-angle edges ([layout.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/Views/layout.mdx)). Manual layouts are kept apart from the model, one file per view at `.likec4/<view-id>.likec4.snap` ([config docs](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/config/index.mdx), [LikeC4ManualLayouts.ts](https://github.com/likec4/likec4/blob/main/packages/language-server/src/filesystem/LikeC4ManualLayouts.ts)).
- **Multiple repos:** each folder with a `likec4.config.json` is a project. `import { serviceA } from 'projectA'` brings in elements from another project, with two limits: "Referenced projects must be loaded in the same workspace" and "Only top-level **model** elements can be imported" ([multi-projects.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/config/multi-projects.mdx)).
- **Planned change:** `diff rfc1 { remove {…} add {…} }` describes a named change without applying it. It is checked against the model, and overlapping diffs produce warnings ([diff.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/dsl/diff.mdx)). This is close to a Proposed ADR.
- **AI support:** an MCP server for queries, and an agent skill that teaches the DSL "so they can write DSL code without hallucinating" ([ai-tools.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/tooling/ai-tools.mdx)). A typed TypeScript `Builder` can also build models in code ([builder.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/tooling/model-api/builder.mdx)).

### Structurizr (DSL)

All facts below are from the [language reference](https://docs.structurizr.com/dsl/language) unless another source is linked.

- **Elements and nesting:** the C4 hierarchy is fixed: `person` and `softwareSystem` at the top, `container` inside a system, `component` inside a container. `group` groups elements at a single level. A custom `element` exists for things outside C4.
- **Relationships:** `a -> b "description" "technology" tags`, or `-> b` inside an element's block. `url`, `properties` and `perspectives` work on elements and relationships.
  - **Implied relationships are stored in the model by default.** A relationship between a person and a container also creates one between the person and the container's software system. Only one implied relationship is made per pair, "based on the first relationship defined" ([implied relationships](https://docs.structurizr.com/dsl/cookbook/implied-relationships/)).
- **Deployments:** the hierarchy is `deploymentEnvironment` → nested `deploymentNode` (with an `instances` count or range) → `softwareSystemInstance` or `containerInstance`, plus `infrastructureNode` for things like load balancers.
  - `deploymentGroup` limits which instances get each other's relationships. Without it, relationships are copied between all instances.
  - `healthCheck <name> <url>` and `url` are allowed on instances. **This is the only tool of the five where a URL can belong to one Deployment.**
- **Dynamic Views:** steps are `a -> b "desc"` or a relationship identifier, with an optional `order:` prefix. **Steps must match a model relationship.**
  - Structurizr for Java throws `"A relationship between X and Y does not exist in model."`. A step whose reverse relationship exists counts as a reply ([DynamicView.java](https://github.com/structurizr/java/blob/master/structurizr-core/src/main/java/com/structurizr/view/DynamicView.java), [DynamicViewContentParser.java](https://github.com/structurizr/java/blob/master/structurizr-dsl/src/main/java/com/structurizr/dsl/DynamicViewContentParser.java)).
  - Parallel sequences exist in the Java API (`startParallelSequence`).
- **View definitions:** view types are tied to C4 levels: `systemLandscape`, `systemContext`, `container`, `component`, `filtered`, `dynamic`, `deployment` and `custom`. If no views are defined, default views are generated.
  - `include` and `exclude` take identifiers, `*`, `*?`, or quoted expressions ([expressions](https://docs.structurizr.com/dsl/expressions)): `->x->`, `element.type==Container`, `element.parent==…`, `element.tag==…`, `element.properties[team]==payments`, `relationship.tag==…`, combined with `&&` and `||`.
- **Ownership:** none. The closest is `properties`, as in the docs' own example `element.properties[team]==payments`. Workspace `users` controls access, not ownership.
- **ADRs and docs:** `!adrs` and `!docs` import decision records and documentation into a software system.
- **Layout:** manual layout is stored in `workspace.json`, not in the DSL. When the DSL changes, layout is merged by element name with the internal ID as fallback. Renaming an element and reordering DSL lines can lose its layout, because internal IDs follow creation order ([troubleshooting](https://docs.structurizr.com/local/troubleshooting)).
- **Multiple repos:** `workspace extends <file|url>` and `!include` pull in other DSL files. There is no model of separately owned projects.

### Backstage software catalog

- **Entities:** `Component` (required `type`, `lifecycle`, `owner`), `API`, `Resource`, `System`, `Domain`, `Group`, `User` and `Location` ([descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format), [system model](https://backstage.io/docs/features/software-catalog/system-model)).
  - Nesting runs Domain ⊃ System ⊃ Component/Resource/API through `spec.system` and `spec.domain`, plus `subcomponentOf` and `subdomainOf`.
  - There are no C4 levels. `type` is free text.
- **Relationships:** typed, untitled edges generated from spec fields: `dependsOn`/`dependencyOf`, `providesApi`/`consumesApi`, `partOf`/`hasPart`, `ownedBy`/`ownerOf`, `memberOf`, `parentOf` ([well-known relations](https://backstage.io/docs/features/software-catalog/well-known-relations)).
  - An edge has no description, protocol or technology. Interaction detail lives in API definitions (OpenAPI and so on).
  - References look like `kind:namespace/name`, and kind and namespace have defaults ([descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format)).
- **Deployments:** **none.** The descriptor format defines no environment or deployment fields. `lifecycle` (experimental, production, deprecated) is maturity, not Environment. URLs exist only as untyped `metadata.links` ([descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format)). Runtime data comes from plugins keyed by `annotations`.
- **Views, Dynamic Views, Layout:** none in the catalog model. Pages are generated per entity.
- **Ownership:** **first-class and required.** `spec.owner` is mandatory on Component, API, Resource, System and Domain, and points to a `Group` or `User`. It generates `ownedBy`/`ownerOf`.
- **Multiple repos:** a `catalog-info.yaml` in each repo, found through `Location` entities. This is the closest prior art to Archidocs' Project → Workspace shape.

### IcePanel (SaaS, API-first, not git)

- **Elements:** a fixed set of types with explicit C4 levels: `actor`, `system`, `group` (L1), `app` (deployable) and `store` (data) at L2, and `component` (L3, inside an app or store). Objects form a `parentId` tree under one `root` per domain ([model objects](https://developer.icepanel.io/core-concepts/model-objects)).
  - Objects carry `status` (`live`, `future`, `deprecated`, `removed`), `external`, `teamIds[]`, `technologyIds[]`, `tagIds[]` and `labels`.
  - Note the split: **IcePanel separates `store` from `app` at level 2**, where Structurizr uses one `container` type.
- **Relationships:** `connections` have `originId`, `targetId`, `direction` (`outgoing` or `bidirectional`) and a name. The API can filter by `viaId`, a connection "passing through" an intermediate object such as a broker. Connections share the object `status` lifecycle ([connections](https://developer.icepanel.io/core-concepts/model-connections.md)).
  - The model viewer shows "direct and lower connections" between two objects ([model viewer](https://docs.icepanel.io/core-features/model-viewer.md)).
- **Deployments:** **no deployment model.** The guidance is to draw deployment with `groups` and tags on a separate diagram, usually at level 2 ([groups](https://docs.icepanel.io/core-features/modelling/groups.md), [IcePanel blog](https://icepanel.io/blog/2024-10-16-how-to-create-deployment-diagrams-icepanel)). Groups list "Environment information" as a use case.
- **Views:** typed `context-diagram`, `app-diagram` and `component-diagram`. They are views onto the model, but objects are **placed by hand** on each diagram, not chosen by a query ([diagrams](https://developer.icepanel.io/core-concepts/diagrams.md), [diagramming](https://docs.icepanel.io/core-features/diagramming.md)). A read-only, auto-laid-out "model viewer" shows everything.
- **Dynamic Views:** `flows` live **inside a diagram**. A `Message` step uses "an existing connection in the diagram", and a reply flips direction for that step only.
  - Other step types: Process, Alternate paths, Parallel paths, Go to another flow, Information, Introduction and Conclusion ([flows](https://docs.icepanel.io/visual-storytelling/flows.md)).
- **Ownership:** "Ownership teams" can be assigned to objects, more than one team per object, on Growth and Isolation plans only. Object details can be locked so only the owners can edit them ([ownership teams](https://docs.icepanel.io/collaboration/ownership-teams.md)).
- **History:** immutable numbered `versions` of a landscape, and drafts ([overview](https://developer.icepanel.io/core-concepts/overview)). There is no git history.

### Ilograph (YAML, single diagram file)

All facts below are from the [spec](https://www.ilograph.com/docs/spec/) unless another source is linked.

- **Elements:** `resources` form a tree through `children`, with `abstract` and `instanceOf` for inheritance and an optional `url`. There are no types and no C4 levels.
- **Relationships:** **defined per perspective (view), not on resources**: `perspectives[].relations[]` with `from`, `to`, `via` and `label`. Comma lists create several relations at once ([relation perspectives](https://www.ilograph.com/docs/editing/perspectives/relation-perspectives/)). No single store answers "how are A and B connected" across perspectives.
- **Deployments:** none. A per-perspective `overrides` with `parentId` can re-parent a resource, for example inside a server in one perspective ([parent overrides](https://www.ilograph.com/docs/editing/perspectives/parent-overrides/)). Top-level `contexts` give other trees.
- **Dynamic Views:** a perspective's `sequence` has a `start` and `steps`. Each step is one of `to`, `toAndBack`, `toAsync`, `restartAt` or `subSequence`.
- **Views:** a perspective shows the resources its relations mention. `extends` composes perspectives.
- **Ownership:** none.
- **Authoring:** YAML is the only format, which makes Ilograph the main YAML prior art. `imports` take a `namespace`.

## Comparison

| Concern | LikeC4 | Structurizr | Backstage | IcePanel | Ilograph |
| - | - | - | - | - | - |
| C1–C3 levels | User-defined kinds | Fixed: person/system/container/component | None (`type` is free text) | Fixed: actor/system → app/store → component | None |
| Nesting | Any depth, FQN | Fixed by level | `system`/`domain` refs | `parentId` tree | `children` tree |
| Higher-level edges | Derived when a view is built | Stored as implied, one per pair | None | "Lower connections" shown | None |
| Relationship metadata | Title, description, technology, kind, tags, links, metadata | Description, technology, tags, url, properties | Edge type only | Name, direction, via, status, tech, tags | Label, via, per view |
| Deployment model | Node tree + `instanceOf` | Environment → node → instance (+ groups) | None | None (groups or tags) | None (overrides) |
| URL per Deployment | Untyped `link` | `url` and `healthCheck` on instance | Untyped `links` | Untyped links | `url` on resource |
| Dynamic-view steps | Free in view, model fills titles | Must match model relationship | — | Must use connection on diagram | Free in view |
| View selection | Ordered predicates + `where` | `include`/`exclude` expressions | — | Placed by hand | Relations in perspective |
| Ownership | Convention (metadata or tag) | Convention (properties) | **Required `spec.owner`** | **Teams (paid plans)** | None |
| Layout storage | `.likec4/<view>.likec4.snap` | `workspace.json` | — | SaaS | Automatic |
| Multi-repo | Projects, same-workspace `import` | `extends`/`!include` | **Per-repo YAML + Locations** | SaaS landscapes | `imports` |

## Fit to the six persona questions

✓ = a first-class answer. ~ = possible by convention or by hand. ✗ = no model support.

| Question | LikeC4 | Structurizr | Backstage | IcePanel | Ilograph |
| - | - | - | - | - | - |
| 1. How are two Services connected? | ✓ (incl. derived) | ✓, but implied edges keep only the first description | ~ untitled edges; detail is in API specs | ✓ (incl. via, lower connections) | ✗ relations live in each view |
| 2. Where is a Service deployed? | ✓ | ✓ | ✗ (plugins) | ~ groups and tags | ~ overrides |
| 3. What does my Team own? | ~ metadata or tag | ~ properties | ✓ | ✓ (paid) | ✗ |
| 4. Upstream and downstream of an outage | ~ one hop per predicate (`-> x`, `x ->`) | ~ one hop (`->x->`) | ~ graph of `dependsOn` | ~ model viewer | ✗ |
| 5. URL of a Service in an Environment | ~ untyped link on node or instance | ✓ `url` on instance | ~ untyped link, no Environment | ~ | ~ |
| 6. ADRs and change over time | ~ git, plus `diff` for planned change | ✓ `!adrs`, plus git | ~ (plugins), plus git | ~ versions, no ADRs | ~ git |

Most common failures:
- Q3 and Q5 are not typed in the models that have deployments.
- Q4 has no transitive query.
- Q1 breaks wherever relationships belong to views (Ilograph) or carry no data (Backstage).

## Evidence on LLM authoring (YAML vs TypeScript vs custom grammar)

**The evidence is thin.** I found no study that compares YAML, TypeScript and a custom DSL head to head for architecture models. What does exist:

1. **Frontier models produce valid YAML and JSON almost always; small models do not.**
   - StructEval (TMLR 2026) scored Text→YAML at GPT-4o 97.68, Qwen3-4B 78.74 and Phi-3-mini 36.92. Text→JSON scored 99.36, 90.96 and 68.84. Text→TOML collapsed for small models: Qwen3-4B 7.44, Phi-3-mini 0.00 ([StructEval, arXiv 2505.20139](https://arxiv.org/html/2505.20139v3), appendix tables).
   - The score is 80% keys and paths, 20% syntax, so it measures structure as well as parseability.
   - The paper does not test TypeScript as a data format.
2. **Custom grammars need the grammar in front of the model.**
   - Grammar prompting (adding a BNF grammar to every example) lets LLMs "perform competitively" on DSL tasks where they otherwise struggle to generalise from a few examples ([Wang et al., NeurIPS 2023](https://arxiv.org/abs/2305.19234)).
   - Code-model accuracy drops on languages with less training data. MultiPL-T roughly doubled accuracy for Racket and OCaml only by creating more training data ([Cassano et al., OOPSLA 2024](https://arxiv.org/abs/2308.09895)).
   - LikeC4 ships a DSL skill "so they can write DSL code without hallucinating" ([ai-tools.mdx](https://github.com/likec4/likec4/blob/main/apps/docs/src/content/docs/tooling/ai-tools.mdx)).
   - Structurizr's own AI page says generated DSL needs "a little cleanup" ([Structurizr DSL generation](https://docs.structurizr.com/ai/dsl-generation)).
   - Both are vendor statements, not measurements.
3. **TypeScript errors are mostly type errors, and the compiler catches them.** In type-constrained decoding research, about 94% of compile errors were type-check failures, and constraining on types more than halved compile errors ([Mündler et al., PLDI 2025](https://arxiv.org/abs/2504.09246)). MultiPL-E found Codex "matches or even exceeds its performance on Python for several other languages" ([arXiv 2208.08227](https://arxiv.org/abs/2208.08227)). So TypeScript is a high-resource language. But authoring in it means **running code** to get the model.
4. **In architecture generation the bottleneck is meaning, not syntax.**
   - R2ABench (PlantUML) reports that models usually produce valid views, and "edge hallucination is the dominant structural failure mode" ([arXiv 2604.06683](https://arxiv.org/abs/2604.06683)).
   - A study of 4,137 views generated from 340 repositories found output "syntactically valid" but at the wrong level of detail ([arXiv 2603.21178](https://arxiv.org/abs/2603.21178)).
5. **JSON Schema serves YAML, editors and MCP from one source.**
   - YAML can be checked against JSON Schema in editors, for example `# yaml-language-server: $schema=…` ([yaml-language-server](https://github.com/redhat-developer/yaml-language-server)).
   - MCP tool inputs are JSON Schema ([MCP tools spec](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).
   - A custom grammar or TypeScript gets neither for free.

Conclusion: the evidence favours a structured data format checked by a schema. It does not favour a custom grammar, and the map already rules one out. The deciding factor is not YAML versus TypeScript syntax. It is **catching invented or broken references** (edges) with precise errors.

## Could not confirm

- Whether Structurizr renders dynamic views as sequence charts natively. The language reference doesn't say.
- IcePanel's full nesting rules (whether groups nest, or systems nest in systems), and its full connection and flow schemas. The public pages give only partial field lists.
- Any measured comparison of LLM accuracy writing YAML vs TypeScript config for the same schema.

## Implications for Archidocs

### Core domain model ticket

1. **Fixed C1–C3 Element types, not user-defined kinds.** System (C1), Service (C2), Component (C3), plus an actor or person type and an `external` flag. LikeC4's free kinds leave "C2 view" undefined. Structurizr and IcePanel show that fixed levels make C1–C3 Views generatable.
   - Store Service sub-type (web app, datastore, queue…) as a facet, not a new level. This avoids IcePanel's split of `app` and `store`.
   - Glossary gap: there is no term yet for actors or people, or for external Systems. Run `domain-modeling`.
2. **Store Relationships only as declared. Derive higher-level edges when queried, as LikeC4 does.** Structurizr's stored implied relationships keep only the first description per pair, which hurts Q1.
   - Each Relationship has: consumer, provider, description, technology or protocol, optional `sync`/`async`, tags.
   - Each has an optional stable `id` so Dynamic Views can reference it.
3. **Stable, global, human-readable IDs** (`project/service[/component]`, like Backstage's `kind:namespace/name`), never IDs based on position or order. Structurizr loses layout when IDs follow creation order. Layout, cross-Project references and Workspace Bundle diffs all key on these IDs.
4. **A Deployment model shaped like Structurizr's, with Archidocs vocabulary:** Environment → Deployment Target (nestable) → Deployment, which is an instance of a Service.
   - **Give Deployment a typed `url` field, plus optional named endpoints.** No prior tool besides Structurizr types this, and Q5 depends on it.
   - Deployments inherit Relationships from the logical Model. Leave out deployment-only Relationships and deployment groups in v1.
5. **Make `owner` first-class, following Backstage:** one Team per Element, defaulting to the Project's Team (as the glossary says). Teams are defined once per Workspace. A single owner keeps accountability clear; IcePanel allows several.
6. **Dynamic View steps must reference existing Relationships, as Structurizr requires.** A reverse step counts as a reply. This keeps the Model the single source of truth and makes Q1 complete; LikeC4's free steps can drift from the Model.
   - Support `parallel` in v1. `alt`/`opt` are optional; LikeC4 still marks them experimental.
   - A sequence chart needs leaf participants (LikeC4's limit), so steps that use Systems or Services must be resolved or rejected.
7. **Views are ordered include/exclude predicates written as structured data, not string expressions.**
   - Minimum set: element, children, descendants, incoming, outgoing, between, plus `where` on type, tag, owner and Environment.
   - **Generate a default View for every System and Service at each C level**, as Structurizr does when none are defined, so the persona questions never depend on hand-written Views.
   - Add a **transitive upstream/downstream query with a depth limit**. No prior tool has one, and Q4 needs it in both MCP and the viewer.
8. **Layout:** one file per View, keyed by View ID and Element IDs, outside the Model files (LikeC4's `.likec4/*.snap` pattern). It stays out of scope for v1 but the format reserves room for it.
9. **Proposed ADRs:** LikeC4's `diff` block (a named, checked change set with overlap warnings) is useful prior art. For v1 the PR is the diff, and an ADR links the Elements it affects.

### Authoring-format ticket

1. **Use YAML 1.2 checked against a published JSON Schema.** Generate the schema from the TypeScript types (for example Zod or TypeBox) so the CLI, MCP tool `inputSchema`s and editor checks share one source. Accept JSON as an equivalent form.
2. **Don't make TypeScript the authoring format in v1.**
   - Evaluating it means running code from about 50 repos in CI and in the MCP server.
   - It ties Projects in other languages to a Node toolchain.
   - It works against "declared-only".
   - A typed builder that *emits* YAML can come later, like LikeC4's `Builder`.
3. **Put Relationships under the consumer** (`dependsOn: [{ to, description, technology }]`). This matches the glossary's direction (consumer → provider), Backstage's `dependsOn`, and LikeC4's sourceless relationships. Each file then describes its own Services and their outgoing dependencies, which fits per-repo ownership.
4. **Spend the validation effort on references, not syntax.** Edges are where LLMs hallucinate. `archidocs check` and the MCP write or validate tools should report unknown IDs with did-you-mean suggestions, check cross-Project references against the Workspace Bundle, and flag Dynamic View steps with no matching Relationship.
5. **Keep the YAML simple:** no anchors, aliases or merge keys, and a flat layout of one Service per file or block. Ilograph and Backstage show plain YAML is enough for this domain. The authoring skill served over MCP should include the schema and two or three canonical examples, following the grammar-prompting result.
