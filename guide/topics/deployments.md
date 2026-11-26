# Deployments

A **Deployment Target** is where Services run (a region, a cluster in it, a namespace, a platform); Targets nest to any depth, have their own Owner, and are not Elements. A **Deployment** is one Service in one Environment on one Target, named by that triple, and is the only place a URL lives.

## Steps

1. **Environment.** `list_environments`. Environments are defined once in `workspace.yaml`; add a missing one with `upsert_environment(id, fields: {name})` only after the user confirms it, because every Project shares it.
2. **Targets.** `upsert_target(project, id, fields, parent?, file?)`:
   - `fields`: `name`, `kind` (required: `region`, `cluster`, `namespace`, `platform`, ...), `description`, `owner`, `tags`, `links`.
   - `parent` nests it in the parent's file. A Target can't be moved; remove it and add it again.
   - Target ids share the Project's id namespace with Elements. Reuse a Target from another Project as `project:id`, resolved with `search_elements` or `get_deployments`.
3. **Deployment.** `upsert_deployment(project, service, environment, target, fields, file?)`:
   - `fields`: `url` (the Service's main URL in that Environment), `endpoints` (`[{name, url}]` for further named URLs: admin, health, gRPC) and `instances` (see Scaling).
   - A new Deployment goes beside the Project's other Deployments unless `file` is given.
4. **Finish** the edit loop.

## Scaling

`instances` says how many copies of the Service run on the Target: a whole number for a fixed count, `{min, max}` for an autoscale range. Leave it out for one. A scaled Deployment draws as a stack with a `×3` or `2–10` chip.

- **Use `instances`** for interchangeable copies on one Target: an App Service plan running N workers, a Kubernetes Deployment with N replicas, an autoscaling group.
- **Use separate Deployments** when where each copy runs is the point: one per availability zone, one per named VM, the members of a Solr or ZooKeeper ensemble. Give each its own Target, so the View shows the placement.
- Don't put the count in the Target's name ("autoscale 2–10"): one Target can host Deployments that scale differently.

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
    instances: 3 # fixed: three interchangeable copies
    endpoints:
      - name: health
        url: https://cart.example.com/healthz
  - service: search
    environment: prod
    target: eks-main
    instances: { min: 2, max: 10 } # autoscale range
```
