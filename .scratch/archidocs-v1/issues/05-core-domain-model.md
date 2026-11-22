# Core domain model

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 01
Map: [Archidocs v1](../map.md)
Context: [How existing tools model architecture](01-prior-art-modelling.md) (see its Answer and research file)

## Question

What is the core Model? Settle: Element kinds (fixed C4-style vs user-defined) and how they nest (System > Service > Component); people and external systems for C1; Relationship attributes (technology, protocol, sync or async, description) and how async channels such as topics or queues are modelled; Team; Environment, Deployment Target nesting (region > cluster) and Deployment; where URLs sit; Element id rules; and the metadata or tags every Element carries.

## Answer

Settled in a grilling session on 2026-11-21. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (Person, External, Element narrowed to the logical Model, Deployment Target, Owner).

**Elements**
- **Four fixed kinds:** Person, System (C1), Service (C2), Component (C3). Kinds are not user-defined.
- **Strict nesting:** System > Service > Component. A Service may sit outside any System. Systems never nest in Systems and Components never nest in Components. A Person is top-level and never nests.
- **Every Element has:** id, name, description, Owner, tags, links (label + URL). No free-form metadata and no lifecycle status in v1.
- **Kind-specific fields:**
  - Service: `type` (`app` | `datastore` | `broker`, default `app`), `technology` (free text, such as Postgres), `external`.
  - System: `external`.
  - Component: `technology`.
  - Person: none.
- **External** is a flag on System and Service, not a kind. An External Element can't contain declared Components.
- **Ids:** a short slug chosen by the author, unique within its Project, and independent of nesting, so re-parenting an Element never changes its id. Ids are never generated from position or order. Namespacing across Projects is left to [Workspace aggregation](07-workspace-aggregation.md).

**Relationships**
- **Stored only as declared,** at the lowest level the author knows. Edges between higher-level Elements are derived at query time, and a derived edge carries every Relationship beneath it. Implied edges are never stored.
- **Fields:** consumer, provider, description, technology (free text), interaction (`sync` | `async`, default `sync`), tags, and an optional id (a slug unique within the Project) for Dynamic View steps. One pair of Elements can have several Relationships.
- **Endpoint rules:**
  - Any Element can be a consumer; any Element except a Person can be a provider.
  - A Relationship between an Element and its own ancestor or descendant is rejected.
  - A derived edge that collapses onto a single node is dropped from that View but still counts in queries at the lower level.
- **Async channels:** the subscriber → publisher Relationship is `async`, with an optional `via` (the broker Service) and `channel` (the topic or queue name). Topics are never Elements. Impact queries count the `via` broker as a dependency of both sides.

**Ownership**
- **Exactly one Owner (a Team)** per Element, defaulting to the Project's Team and overridable per Element.
- A Relationship belongs to its consumer's Owner; a Deployment belongs to its Service's Owner. Deployment Targets have their own Owner.
- **Teams:** defined once per Workspace with id, name, description and links. Teams are flat (no sub-Teams) and have no member list; a Developer picks their Team.

**Deployment**
- **Environment:** defined once per Workspace.
- **Deployment Target:** declared in any Project and referenceable from others. It nests to any depth (region > cluster > namespace) and has id, name, kind (free text), Owner and tags. A Deployment Target is not an Element.
- **Deployment:** exactly one Service in one Environment on one Deployment Target. It is identified by that triple and has no id of its own; a duplicate triple is a validation error. A Service can have several Deployments in one Environment.
- Deployments take their Relationships from the logical Model. No deployment-only Relationships in v1.

**URLs**
- URLs belong only to a Deployment: an optional typed `url` (the main entry point) plus optional named `endpoints` (name + URL). A Service has no URL of its own.

