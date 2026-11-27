---
name: archidocs-consult
description: Check the Archidocs architecture Model before and after changing code. Use when changing a public API, event or schema, adding or removing a dependency on another Service, datastore or broker, renaming or retiring a Service, changing deployment config, or answering who calls, owns or deploys something.
---

# Archidocs consult

You are changing code in a Service's repo. The Model says who depends on that Service, who owns them, where it runs and what was decided about it. Read it before you edit, report what matters in four lines, and check afterwards that the Model still matches the code.

This skill only reads. It never writes the Model: when the Model needs a change, hand off to the authoring skill (load it first with `get_guide("authoring")`, or `archidocs guide --skill authoring` without MCP) and follow its topic.

## Before the change

Run these read tools, in order:

1. **Resolve** the Service: `search_elements` with its name, repo name, or a URL or host from its config. Take the `project:id` of the Element the code implements. If nothing matches, see [Not in the Model](#not-in-the-model).
2. **Consumers**: `get_impact(id, direction: "upstream", max_depth: 1)` for the Elements that call it directly, each with its Owner and the Relationships that connect them. Call `get_impact(id, direction: "upstream")` once more without `max_depth` and subtract, for the count of indirect consumers.
3. **Owners**: the Element's own `owner` from step 1, and each direct consumer's Owner from step 2. The Teams to tell are the consumers' Owners other than the Element's own.
4. **Deployments**: `get_deployments(service: id)` for each Environment, Deployment Target and URL it runs at. Do this when the change touches deployment config, and to name what a change reaches.
5. **ADRs**: `list_adrs(element: id)`, then `get_adr` for any whose title touches what you are changing. Note each one's status; only `accepted` ones bind.

### Report

Before editing, tell the user what you found in four lines:

```text
Consumers: web (storefront), checkout (payments) +4 indirect
Teams to tell: storefront, payments
Deployments: prod on eks-main (https://cart.example.com), staging on eks-staging
ADRs: shop:0003 Cart is the only writer of cart state (accepted)
```

Write "none" on a line with nothing to report. Then carry on with the change.

## When to stop and ask

Stop and ask the user before editing in only two cases:

- **An Accepted ADR contradicts the change.** Quote the ADR's id, title and the sentence the change goes against. The user decides whether to change course or supersede the ADR (authoring's `propose-adr` topic).
- **The change breaks a contract another Team's consumer uses.** A removed or renamed endpoint, field, event or channel that a consumer owned by another Team relies on. Name the consumer and its Owner.

Otherwise carry on. A consumer on your own Team, a Proposed ADR, or a judgement that the change is risky is something to report, not a reason to stop.

## After the change

Compare only the dependencies this change touched (a client, SDK call, queue or topic, datastore connection added, removed or pointed elsewhere) with the Element's Relationships, from `get_impact(id, direction: "downstream", max_depth: 1)`. Also check a renamed or retired Service, and a changed URL or Environment against `get_deployments`.

When they differ, say so in one line per difference and offer to update the Model. On a yes, load authoring and follow its `relationships` topic for a Relationship, or `add-service` for a new or renamed Service and its Deployments.

Drift you notice beyond this change (a Relationship the code no longer has, an empty description) gets one line suggesting the `fill-gaps` skill. Don't fix it here.

## Not in the Model

When `search_elements` finds nothing, say so in one line ("cart isn't in the Archidocs Model") and carry on with the code change. Afterwards, offer to add it with authoring's `add-service` topic, or `bootstrap` if its Project is missing too.

## Answering questions

| Question | Tool |
| --- | --- |
| Who calls it? | `get_impact(id, direction: "upstream")` |
| What does it call? | `get_impact(id, direction: "downstream")` |
| How does A reach B? | `find_paths(from, to)` |
| Who owns it? | the Element's `owner` (from `search_elements` or `get_element`); a Team's Elements with `list_owned` |
| Where does it run? | `get_deployments(service, environment?)` |
| What changed? | `get_changes(scope)`, `list_history(scope)` |
| Why is it like this? | `list_adrs(element)`, then `get_adr(id)` |

Give `max_depth: 1` for only the Elements one hop away. Answer from the tool's result, and name the `project:id`s.

## Without MCP

With no Archidocs MCP server, read the Workspace YAML directly. Each Project folder holds `project.yaml` and the files that declare its Elements, Relationships and Deployments; ADRs are in `<project>/adr/`.

- **The Element**: search the Project's YAML for its id or name, or its URL among the `deployments`.
- **Consumers**: Relationships sit under the consumer and point `to` the provider. For an Element `cart` in Project `shop`, search the Workspace for:
  - `to: cart` in files under `shop/` (a bare id within the Project);
  - `to: shop:cart` anywhere (another Project's reference);
  - `via: cart` under `shop/` and `via: shop:cart` anywhere, when it is a broker: each such Relationship's consumer and its `to` both depend on it.

  For example: `grep -rnE "(to|via): (shop:)?cart\b" archidocs/` and then drop bare-id matches outside `shop/`. The consumer is the Element the matching Relationship sits under; its Owner is its `owner`, else the Project's.
- **Deployments**: the `deployments` entries with `service: cart`.
- **ADRs**: the files in `<project>/adr/` whose `elements` list names the Element; `status` is in the frontmatter.

Count only direct consumers this way; write "indirect not counted" in the report.
