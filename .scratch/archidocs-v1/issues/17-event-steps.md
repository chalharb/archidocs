# Event Steps in Dynamic Views

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: –
Map: [Archidocs v1](../map.md)
Context: [Sequence chart prototype](13-sequence-chart-prototype.md) drew events publisher → subscriber and resolved them to the subscriber's `via` Relationship, a Step kind that [View kinds and definitions](10-view-definitions.md) doesn't define. Its prototype also shows the broker drawn both ways (`?async=direct|broker`).

## Question

How does a Dynamic View show an async event? [Core domain model](05-core-domain-model.md) stores a subscription as subscriber → publisher with `via` and `channel`, but the event travels publisher → subscriber. Settle:
- how a Step names an event delivery: `from` publisher, `to` subscriber resolving to the subscription, a flag, or something else;
- whether the broker is a participant, as one arrow or as publish and deliver legs, and how they're numbered;
- how async Relationships without `via` (fire-and-forget calls) differ;
- what `get_view` returns for such a Step;
- which `archidocs check` rules follow from it.

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (Step widened to event deliveries; Publisher and Subscriber added). This amends the Dynamic View parts of [View kinds and definitions](10-view-definitions.md) and adds one rule to [archidocs check](16-archidocs-check.md).

**Authoring an event Step**
- **Written the way the event travels:** `{from: <publisher>, to: <subscriber>}`, with no flag. The stored Relationship stays subscriber → publisher with `via` and `channel`, as in [Core domain model](05-core-domain-model.md).
- **Resolution:** a non-return Step collects both candidates:
  - forward Relationships `from → to` that have no `via`;
  - reverse `via` subscriptions `to → from`.
  If exactly one matches, that is the Step. If both kinds match (the publisher also calls the subscriber), it's `ambiguous-step` unless `relationship:` names one. The prototype's silent preference for the forward match is dropped.
- **Higher levels:** as for calls, an event Step may connect higher-level Elements (Systems, Services) when the reverse derived edge carries at least one `via` subscription. Several subscriptions under that edge are `ambiguous-step` unless `relationship:` names one.
- **Fan-out:** one Step per subscriber. No `to: [a, b]` list form (parallel blocks are already out of v1).
- **Default label:** an event Step with no `description` shows the Relationship's `channel`. It falls back to the Relationship's description only when there's no `channel`, because that text reads from the subscriber's side. Calls and returns keep the Relationship's description.

**The broker**
- **Not a participant.** An event Step is one Step with one number, drawn as one arrow publisher → subscriber in the async style (solid line, open head). The broker and channel show on the label (`via event-bus · payment-events`) and in the detail panel.
- **"Show brokers" viewer toggle:** off by default and never stored in the View, like the Sequence | Graph toggle. When on, each event Step is drawn as a publish leg (publisher → broker) and a deliver leg (broker → subscriber), numbered `na`/`nb`. The legs share Step n's selection, outline row and detail. Repeated publish legs in a fan-out aren't merged.
- **It still counts as taking part:**
  - `list_views(element: <broker>)` and `get_element(<broker>).dynamicViews` include Dynamic Views with an event Step `via` it;
  - the detail panel's View buttons add the broker's `c2/<system>` after the subscriber's and publisher's.
  This matches impact queries, which already count `via` as a dependency of both sides.

**Async Relationships without `via`** (fire-and-forget calls)
- Same direction as declared: `from` consumer, `to` provider, drawn async (open head, no activation bar).
- **No returns on async:** `return: true` may only resolve to a sync Relationship, with or without `via` on the async one. A callback is modelled as its own Relationship.

**`get_view` for Dynamic Views**
- Steps become `{n, kind: call | return | event, from, to, relationship, interaction, via?, channel?, description, note?}`. `kind` replaces the boolean `return`.
- `from` and `to` are as drawn (publisher → subscriber for events). `relationship` names the stored subscriber → publisher Relationship, so `kind: event` is what tells an agent the direction is flipped. `via` and `channel` are copied from the Relationship.
- MCP never returns legs. `na`/`nb` exist only in the viewer.

**`check`**
- **New error `return-on-async`:** a return Step resolves to an async Relationship.
- **`missing-step` and `ambiguous-step` widen** to cover the reverse `via` match, at derived levels too.
- `unknown-element` already covers the ids. No warning for a publisher that appears nowhere else in the View.
