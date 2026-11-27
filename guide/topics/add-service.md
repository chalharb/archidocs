# Add a Service

Add one Service with its Components, Relationships and Deployments.

## Steps

1. **Place it.** Find the Project (`get_workspace_info`, `search_elements`) and, if it belongs to one, its System. Confirm the id: a lowercase slug unique in the Project across Elements and Deployment Targets.
2. **Service.** `upsert_element(project, kind: "service", id, fields, parent?)`:
   - `fields`: `name`, `description` (Markdown), `technology`, `type` (`app` by default, `datastore`, `broker`), `external`, `repository` (the source code URL), `tags`, `links`, `metadata` (free-form `key: value` facts); `owner` only when it differs from the Project's.
   - `parent` names the System. A new Element goes into its parent's file; with `file` as well it goes top-level in that file and attaches with `in:`. A top-level Service goes into `file`, else `model.yaml`.
   - `fields` never sets `relationships`, `components` or `in`; each has its own tool or parameter.
3. **Components.** For each, `upsert_element(kind: "component", parent: <service>)`. An External Service has no Components.
4. **Relationships.** Follow the `relationships` topic for each outbound dependency.
5. **Deployments.** Follow the `deployments` topic for each Environment the Service runs in.
6. **Finish** the edit loop: show the diffs, run `check`, suggest a branch, PR title and body.

## Example

```yaml
systems:
  shop:
    name: Shop
    services:
      cart:
        name: Cart
        technology: Go
        repository: https://github.com/acme/cart
        components:
          pricing:
            name: Pricing
```
