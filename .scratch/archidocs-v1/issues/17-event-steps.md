# Event Steps in Dynamic Views

Type: grilling
Status: open
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
