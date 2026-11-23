# Dynamic View

A Dynamic View shows one scenario as an ordered list of Steps. Each Step resolves to a Relationship that already exists in the Model.

## Steps

1. **Scenario.** The user describes a scenario ("a shopper checks out") or names an entry point.
2. **Trace.** Follow the path through the Model with `get_element`, `find_paths` and `get_view`, and through code where the Model is silent. Draft the Steps.
3. **Gaps.** When a Step has no Relationship to take, propose adding it with `upsert_relationship` (see `relationships`) and write it once the user agrees. Keep the Step.
4. **Write.** `upsert_view(project, id, definition, file?)`; a `definition` with `steps` is a Dynamic View.
5. **Finish** the edit loop; `get_view(id)` shows the resolved Steps.

## Definition

- `title`, optional `description`, `tags`.
- `participants`: optional; fixes the order of the lifelines. Otherwise they appear in order of first use. An Element and its own ancestor can't both take part.
- `steps`: `[{from, to, relationship?, description?, note?, return?}]`.
  - **Call**: `from` the consumer `to` the provider, over a Relationship or a derived edge between them.
  - **Event**: `from` the Publisher `to` a Subscriber; resolves to the Subscriber's `via` subscription.
  - **Return**: `return: true` is the reply to a sync Relationship declared `to` → `from`. An async Relationship has no reply.
  - `relationship` names the Relationship's id when several match the pair.

```yaml
views:
  dynamic:
    checkout:
      title: Checkout
      steps:
        - from: shopper
          to: web
          description: Places the order
        - from: web
          to: payments:payments-api
          description: Charges the card
        - from: web
          to: payments:payments-api
          return: true
          description: Payment confirmed
```
