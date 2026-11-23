# Saved View

A Saved View is a structural or Deployment diagram the Model keeps: selectors pick the Elements, then the View collapses them to its `level`.

## Steps

1. **Purpose.** Ask who the View is for and what question it answers; that sets the `level` and the selectors.
2. **Check** what the Generated Views (`c1`, `c2`, `c2/<system>`, `c3/<service>`, `deployment/<env>`) already show with `list_views` and `get_view`. Save a View only for what they don't.
3. **Write** `upsert_view(project, id, definition, file?)`. The View's id is unique among the Project's Views; `get_view("project:id")` shows what it resolves to.
4. **Finish** the edit loop.

## Definition

- `title` and `level` (`c1`, `c2`, `c3`, `deployment`) are required; `description`, `tags`, `direction` (`TB`, `BT`, `LR`, `RL`) are optional.
- `include`: selectors to show (every Element when absent). `exclude`: selectors to drop.
  - an id: the Element itself;
  - `{element, with?: children|descendants, upstream?: n|all, downstream?: n|all}`;
  - `{team}`: every Element the Team owns;
  - `{tag}`: every Element with the tag;
  - `{from, to, paths?: shortest|n}`: every Element on the paths between two Elements.
- `expand`: Elements opened one level deeper than `level`. `collapse`: Elements closed.
- `lens`: highlighting the View opens with, never changing its nodes: `{impact, direction?}`, `{team}` or `{path: {from, to}}`.
- A Deployment View (`level: deployment`) also takes `environment` and optionally `targets` (Target subtrees to show).

```yaml
views:
  structural:
    checkout-deps:
      title: What checkout depends on
      level: c2
      include:
        - element: web
          downstream: all
      lens:
        impact: payments:payments-api
```
