# Brief: Archidocs visual language (narrow, pre-domain-model)

You're designing the **visual language** for Archidocs, an open-source, git-native, AI-first architecture-as-code tool. Teams declare their architecture as YAML-style files in their own repos; Archidocs combines them into one model and shows it in a static web viewer built with **React + React Flow**. AI agents query the same model through an MCP server, so the viewer is for people only. It has **no chat panel**.

This is an **early, narrow** pass. The data model, View navigation and full UX flows are **not decided yet** and belong to a later ticket. Your output feeds that ticket; it doesn't replace it.

## Read first

- `GLOSSARY.md`: use these terms exactly (Element, Service, System, Component, Relationship, Upstream/Downstream, Environment, Deployment Target, Deployment, Team, Owner, View, Deployment View, Dynamic View, Workspace). Don't introduce synonyms.
- `.scratch/archidocs-v1/map.md`: the Destination and Notes sections.
- `.scratch/archidocs-v1/research/02-auto-layout-engines.md` and `04-sequence-chart-rendering.md`: the layout and rendering constraints you're designing within.

## Who it's for

Each persona arrives with one question. The visual language must make the answer quick to read once they're on the right View:

1. Enterprise Architect: how are two Services connected?
2. Solutions Architect: where is a Service deployed?
3. Developer: what does my Team own?
4. Product Owner: what's Upstream and Downstream of an outage?
5. QA Tester: what's this Service's URL in staging?
6. Technical resource: which ADRs affect this Element?

## In scope

1. **Visual direction:** tone, type, colour system (light and dark), density. Pick one direction and justify it in 3–5 sentences. It should feel like a precise engineering tool, not a whiteboard toy.
2. **App shell:** the frame around the canvas (header, Workspace and View switcher placeholder, canvas, right-hand Element panel placeholder). Lay it out, but don't design the navigation model; a labelled placeholder is fine.
3. **Node styles for each Element kind and C-level:**
   - C1: Person, System, external System
   - C2: Service (including datastores and message channels, shown as distinct variants of Service), System as an expandable container
   - C3: Component inside an expanded Service
   - States for each: default, hover, selected, dimmed (not in focus), highlighted as Upstream, highlighted as Downstream, "outage" origin.
   - Showing ownership: how a node shows its owning Team at a glance (one Team per Element; there may be 10–30 Teams in a Workspace).
4. **Edge styles:** sync vs async Relationships, a label for technology or protocol, selected and highlighted states, and the direction arrow. Edges are **orthogonal (right-angled)**, so design for that, not curves.
5. **Containers:** System groups in C2, and nesting in Deployment Views (Environment > Deployment Target, such as region > cluster > Deployment). Up to 3 levels of nesting. Containers must read clearly when collapsed and when expanded.
6. **Dynamic View as a sequence chart:** participant headers that stay pinned, lifelines, numbered steps, sync, async and return arrow styles, the selected step, and how a ~50-step chart stays readable (step outline or minimap).
7. **Legend:** a compact legend covering whatever the notation needs.

## Out of scope (don't design these)

- Navigation between Views, search, routing, Element detail page content, filters, ADR reading UI, history and diff UI. These wait on undecided tickets.
- Manual layout or drag-to-position tools. Layout is always automatic (ELK).
- Any chat or AI UI.
- Marketing or landing pages.

## Hard constraints

- **Rendering:** React Flow 12.12.x or 13.0.x custom nodes and edges. Node sizes must be fixed or measurable before layout, because the layout engine needs real sizes to keep edges from passing behind nodes.
- **Layout:** ELK layered, with orthogonal routing and nested containers. Nodes never overlap, edges never pass through nodes, crossings are kept low. Don't rely on hand-placed positions.
- **Scale:** Views of up to ~150 nodes. Show how nodes read at three zoom levels: overview (labels only or hidden), normal, and close. Text shouldn't be the only carrier of meaning at overview zoom.
- **Accessibility:** WCAG AA contrast in both themes. Never use colour alone to carry meaning (Team, highlight states, sync or async); always pair it with shape, line pattern, icon, or text.
- **Neutral by default:** Teams are user data, so Team colour must come from a generated palette that holds up with 30 Teams. Don't build the identity around a brand colour.

## Sample data

Use this fictional landscape for every mock-up. Where a field you need isn't listed, invent one, but **mark it as an assumption** (see Deliverables).

- **Teams:** Payments, Orders, Identity, Platform
- **People:** Shopper, Support Agent
- **Systems:**
  - *Checkout* (Orders): Checkout Web (Service), Checkout API (Service), Orders DB (datastore)
  - *Payments* (Payments): Payments API (Service), Fraud Scorer (Service), Ledger DB (datastore), `payment-events` (message channel)
  - *Identity* (Identity): Auth Service (Service)
  - *External:* Stripe (external System), Email Provider (external System)
- **Relationships:** Shopper → Checkout Web; Checkout Web → Checkout API (HTTPS); Checkout API → Auth Service (gRPC, sync); Checkout API → Payments API (HTTPS, sync); Payments API → Fraud Scorer (gRPC, sync); Payments API → Stripe (HTTPS); Payments API → Ledger DB; Payments API → `payment-events` (async); Checkout API ← `payment-events` (async, subscribe); Checkout API → Email Provider (async)
- **Components inside Payments API (C3):** Payment Controller, Payment Orchestrator, Stripe Adapter, Ledger Repository, Event Publisher
- **Deployments:** prod in us-east and eu-west, each on a Kubernetes cluster; staging in us-east only. Payments API in staging has the URL `https://payments.staging.example.internal`.
- **Dynamic View, "Place order":** about 15 steps across Shopper, Checkout Web, Checkout API, Auth Service, Payments API, Fraud Scorer, Stripe, `payment-events`, with sync calls, returns and one async publish.
- **Outage scenario:** Fraud Scorer is down. Show its Upstream chain highlighted.
- **Scale padding:** for the overview-zoom mock-up only, pad the C2 View to about 150 nodes with generated Services across about 12 Systems and 10 Teams, keeping the named Elements above in place.

## Deliverables

1. A short **direction note** (≤1 page): the direction you chose, type, colour tokens, spacing scale, and the reasoning.
2. **Static mock-ups** (HTML/React or images) of:
   - a C1 View
   - a C2 View with Checkout and Payments expanded, Identity collapsed
   - a C3 View of Payments API
   - a prod Deployment View (region > cluster > Deployment)
   - the "Place order" Dynamic View as a sequence chart
   - the C2 View in the Fraud Scorer outage state
   - all at normal zoom, plus the C2 View at overview zoom
3. A **component sheet** of every node, edge, container and state variant, in light and dark.
4. **Design tokens** as a TypeScript object or CSS variables.
5. An **Assumptions** list: every field, behaviour or interaction you had to invent, so it can be checked against the domain model decisions later.
6. **Open questions:** anything where the notation needs a model decision (for example, whether a message channel is a node or an edge attribute).

## Done when

All six persona questions can be answered visually from the relevant mock-up without reading a legend twice, the C2 overview at ~150 nodes is still legible as structure, and every invented field is listed under Assumptions.
