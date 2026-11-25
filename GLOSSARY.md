# Archidocs

A git-native architecture-as-code tool: teams declare their architecture as files in one Workspace repo, each Team in its own Project folder, and Archidocs combines them into one queryable landscape for people (via a diagram viewer) and AI agents (via MCP).

## Language

### Scope

**Workspace**:
The combined architecture landscape assembled from every Project, kept in one repository; the org-wide view, and the place Teams and Environments are defined.
_Avoid_: Org, landscape, universe

**Project**:
One Team's slice of the Workspace, kept in its own folder; it namespaces the ids of everything declared in it and gives them a default Owner.
_Avoid_: Repo (when meaning the model slice), module, package

**Qualified id**:
An id written with its Project, as `project:id`, so it names one thing across the whole Workspace; within its own Project the bare id is used.
_Avoid_: Full id, global id, path

**Checkout**:
A Workspace root on disk, possibly inside a git repository; what the CLI, `archidocs dev` and the MCP server read a Workspace from, as opposed to a published Workspace Bundle.
_Avoid_: Working copy, clone, local Workspace

### Elements

**Element**:
A node of the logical Model: a Person, System, Service or Component. Every Element has exactly one Owner.
_Avoid_: Node (that is a diagram term), entity, component (unless meaning a C4 component)

**Person**:
A human or role that uses a System, such as a shopper or a support agent; only ever the consumer in a Relationship.
_Avoid_: Actor, User, Persona

**Service**:
A deployable, addressable unit of software; the thing that has a URL and a deployment.
_Avoid_: App, application, microservice, container (C4 term), API (unless the interface itself)

**Component**:
A part inside a Service that is not deployed on its own.
_Avoid_: Module, class, package

**System**:
A named grouping of Services that together deliver a business capability; Systems do not nest.
_Avoid_: Platform, domain, product (unless meaning the business product)

**External**:
Said of a System or Service run outside the organization, such as a payment provider; its Owner is the Team accountable for the integration.
_Avoid_: Third-party, vendor (as a kind)

**Model**:
The single source of truth: every Element and Relationship in a Workspace.
_Avoid_: Diagram, graph (when meaning the source of truth)

**Relationship**:
A directed edge from a consumer Element to the provider Element it depends on, declared once at the level the author knows; edges between higher-level Elements are derived from the Relationships beneath them, never declared.
_Avoid_: Connection, dependency, link, edge (outside diagram contexts)

**Publisher**:
The provider of an asynchronous Relationship that runs through a broker: the Element that sends the events.
_Avoid_: Producer, emitter

**Subscriber**:
The consumer of an asynchronous Relationship that runs through a broker: the Element that receives the publisher's events and declares the subscription.
_Avoid_: Listener, consumer (when the event direction matters)

**Upstream / Downstream**:
For a given Element, upstream is everything that depends on it; downstream is everything it depends on.
_Avoid_: Callers/callees, inbound/outbound

### Deployment

**Environment**:
A named stage that Services run in, such as prod or staging; defined once per Workspace so it means the same thing in every Project.
_Avoid_: Stage, tier

**Deployment Target**:
The place a Service runs within an Environment, such as a region, a cluster within it, or a platform; Deployment Targets nest, have their own Owner, and are not Elements.
_Avoid_: Infrastructure node, host

**Deployment**:
One Service running in one Environment on one Deployment Target; the thing a URL belongs to.
_Avoid_: Instance, release, rollout

### Ownership

**Team**:
A group defined once per Workspace that can own Elements.
_Avoid_: Squad, group, org unit

**Owner**:
The one Team accountable for an Element or Deployment Target; defaults to the Team owning the Project. A Relationship belongs to its consumer's Owner and a Deployment to its Service's.
_Avoid_: Maintainer, steward

### Decisions

**ADR**:
An architecture decision record, stored as a markdown file in its Project and linked to the Elements, Deployment Targets and Saved Views it affects; a **Proposed** ADR is one awaiting acceptance via pull request, and a **Superseded** ADR is one replaced by a later accepted ADR.
_Avoid_: Design doc, RFC, decision log

### Distribution

**Workspace Bundle**:
The combined Model of a Workspace at one commit as a single file, built from the repository and consumed by the viewer and MCP server; it can be rebuilt for any past commit.
_Avoid_: Export, snapshot (unless meaning a specific historical bundle)

**Revision**:
A commit on the Workspace's default branch that changed the Model; the points in time that history is told in.
_Avoid_: Version, snapshot, release

**Change**:
One item of the Model added, removed or changed between two Revisions.
_Avoid_: Delta, diff entry

### Presentation

**View**:
A diagram defined by a query over the Model; never a source of truth.
_Avoid_: Diagram (as the stored thing), page, canvas

**View id**:
The id a View is opened by: a Generated View's scope, such as `c2/<system>`, or a Saved View's Qualified id.
_Avoid_: View name, view path, slug

**Generated View**:
A View derived from the Model for one scope, such as a System's Services or one Environment's Deployments; it exists for every scope without anyone writing it.
_Avoid_: Default view, auto view

**Saved View**:
A View written into a Project's files: a named selection of the Model, or a Dynamic View.
_Avoid_: Custom view, stored diagram

**Structural View**:
A View drawn as boxes and edges, of Elements or of Deployments on their Deployment Targets; every View that is not a Dynamic View.
_Avoid_: Static view, box diagram, element view

**Deployment View**:
A View of Deployments placed on their Deployment Targets within an Environment.
_Avoid_: Infrastructure diagram, topology

**Dynamic View**:
A View of the ordered interactions in one scenario, shown as a sequence chart.
_Avoid_: Flow, sequence diagram (as the stored thing), runtime view

**Step**:
One interaction in a Dynamic View: a consumer reaching a provider over a Relationship, the provider's reply to it, or an event a publisher sends to one subscriber, drawn the way the event travels even though the subscription points the other way.
_Avoid_: Message, call, hop

**Lens**:
A highlighting over a View, such as impact around an Element, a Team's ownership or the paths between two Elements, that marks nodes without changing which ones the View contains.
_Avoid_: Filter, overlay, mode

**Layout**:
The positions of Elements in a diagram, held apart from the model itself so it never changes what the architecture means.
_Avoid_: Diagram (as a synonym), arrangement
