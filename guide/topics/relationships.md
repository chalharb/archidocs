# Relationships

A Relationship is declared under its **consumer** and points `to` the **provider** it depends on. Declare it at the level you know: Component to Component if the code shows which part calls which, else Service to Service. Edges between higher-level Elements are derived from these.

## Write one

`upsert_relationship(project, from, to, fields?, id?)`:

- `from` is the consumer, in this Project. `to` is a bare id in this Project or `project:id` in another; resolve it with `search_elements`.
- `fields`: `description` (what the consumer uses the provider for, as a verb phrase: "Reads prices from"), `technology` ("HTTPS/JSON", "gRPC", "SQL"), `interaction` (`sync` by default, or `async`), `tags`, `via`, `channel`.
- `id` is needed only to tell apart several Relationships on the same pair; with no `id` and several on the pair, the tool returns `ambiguous` with each candidate's file:line.

## Constraints

- A Person is only ever a consumer.
- An Element can't depend on itself, its ancestor or its descendant.
- `via` and `channel` are for `async` only.

## Async through a broker

An event Relationship runs through a broker Service (`type: broker`). The **Subscriber** declares it, pointing `to` the **Publisher**, with `interaction: async`, `via` the broker, and `channel` the topic or queue:

```yaml
services:
  emails:
    name: Emails
    relationships:
      - to: orders
        description: Sends a receipt for each placed order
        interaction: async
        via: platform:kafka
        channel: orders.placed
```

Impact and path queries count the broker as a hop and as a dependency of both sides. An async Relationship with no broker (a webhook, a callback) leaves out `via`.

## Gateways and proxies

An API gateway or reverse proxy (Apigee, Kong, nginx) is a Service in the path by default, `technology` naming the product and `owner` the Team that runs it. The consumer points `to` the gateway, and the gateway `to` the API:

```yaml
# web, in the shop Project
relationships:
  - to: platform:apigee
    description: Places orders through
    technology: HTTPS

# apigee, in the platform Project
apigee:
  name: API Gateway
  technology: Apigee
  owner: platform-team
  relationships:
    - to: shop:api
      description: Routes order requests to
      technology: HTTPS
```

When the gateway is shared infrastructure nobody needs to see, leave it out: `web` points `to` the API directly with `technology: HTTPS via Apigee`. Impact and paths then skip the hop. Either way, the gateway's URL is the API's consumer-facing Deployment `url`. See ADR 0005.

## Cross-Project

Declare only this Project's outbound Relationships. When the provider isn't in the Model, leave the Relationship out and tell the user it is a gap for the provider's Team; create Elements only in this Project. A provider outside the organization may be added here as an External Service.
