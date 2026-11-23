# Deployments

A **Deployment Target** is where Services run (a region, a cluster in it, a namespace, a platform); Targets nest to any depth, have their own Owner, and are not Elements. A **Deployment** is one Service in one Environment on one Target, named by that triple, and is the only place a URL lives.

## Steps

1. **Environment.** `list_environments`. Environments are defined once in `workspace.yaml`; add a missing one with `upsert_environment(id, fields: {name})` only after the user confirms it, because every Project shares it.
2. **Targets.** `upsert_target(project, id, fields, parent?, file?)`:
   - `fields`: `name`, `kind` (required: `region`, `cluster`, `namespace`, `platform`, ...), `description`, `owner`, `tags`, `links`.
   - `parent` nests it in the parent's file. A Target can't be moved; remove it and add it again.
   - Target ids share the Project's id namespace with Elements. Reuse a Target from another Project as `project:id`, resolved with `search_elements` or `get_deployments`.
3. **Deployment.** `upsert_deployment(project, service, environment, target, fields, file?)`:
   - `fields`: `url` (the Service's main URL in that Environment) and `endpoints` (`[{name, url}]` for further named URLs: admin, health, gRPC).
   - A new Deployment goes beside the Project's other Deployments unless `file` is given.
4. **Finish** the edit loop.

## Example

```yaml
targets:
  eu-west-1:
    name: EU West 1
    kind: region
    targets:
      eks-main:
        name: Main EKS
        kind: cluster
deployments:
  - service: cart
    environment: prod
    target: eks-main
    url: https://cart.example.com
    endpoints:
      - name: health
        url: https://cart.example.com/healthz
```
