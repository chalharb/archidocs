# Archidocs

A git-native architecture-as-code tool: teams declare their architecture as files in their own repos, and Archidocs combines them into one queryable landscape for people (via a diagram viewer) and AI agents (via MCP).

## Language

### Scope

**Workspace**:
The combined architecture landscape assembled from every Project; the org-wide view.
_Avoid_: Org, landscape, universe

**Project**:
One repository's slice of the architecture model, authored and versioned in that repository.
_Avoid_: Repo (when meaning the model slice), module, package

### Elements

**Element**:
Anything that can appear as a node in the architecture model and carry an owner.
_Avoid_: Node (that is a diagram term), entity, component (unless meaning a C4 component)

**Service**:
A deployable, addressable unit of software; the thing that has a URL and a deployment.
_Avoid_: App, application, microservice, container (C4 term), API (unless the interface itself)

**Component**:
A part inside a Service that is not deployed on its own.
_Avoid_: Module, class, package

**System**:
A named grouping of Services that together deliver a business capability.
_Avoid_: Platform, domain, product (unless meaning the business product)

**Model**:
The single source of truth: every Element and Relationship in a Workspace.
_Avoid_: Diagram, graph (when meaning the source of truth)

**Relationship**:
A directed edge from a consumer Element to the provider Element it depends on.
_Avoid_: Connection, dependency, link, edge (outside diagram contexts)

**Upstream / Downstream**:
For a given Element, upstream is everything that depends on it; downstream is everything it depends on.
_Avoid_: Callers/callees, inbound/outbound

### Deployment

**Environment**:
A named stage that Services run in, such as prod or staging.
_Avoid_: Stage, tier

**Deployment Target**:
The place a Service runs within an Environment, such as a cluster, platform, or region.
_Avoid_: Infrastructure node, host

**Deployment**:
One Service running in one Environment on one Deployment Target; the thing a URL belongs to.
_Avoid_: Instance, release, rollout

### Ownership

**Team**:
A group defined once per Workspace that can own Elements.
_Avoid_: Squad, group, org unit

**Owner**:
The Team accountable for an Element; defaults to the Team owning the Element's Project.
_Avoid_: Maintainer, steward

### Decisions

**ADR**:
An architecture decision record, stored as a markdown file and linked to the Elements it affects; a **Proposed** ADR is one awaiting acceptance via pull request.
_Avoid_: Design doc, RFC, decision log

### Distribution

**Workspace Bundle**:
The combined Model of a Workspace as a single published file, built in CI and consumed by the viewer and MCP server.
_Avoid_: Export, snapshot (unless meaning a specific historical bundle)

### Presentation

**View**:
A diagram defined by a query over the Model; never a source of truth.
_Avoid_: Diagram (as the stored thing), page, canvas

**Deployment View**:
A View of Deployments placed on their Deployment Targets within an Environment.
_Avoid_: Infrastructure diagram, topology

**Dynamic View**:
A View of the ordered interactions in one scenario, shown as a sequence chart.
_Avoid_: Flow, sequence diagram (as the stored thing), runtime view

**Layout**:
The positions of Elements in a diagram, held apart from the model itself so it never changes what the architecture means.
_Avoid_: Diagram (as a synonym), arrangement
