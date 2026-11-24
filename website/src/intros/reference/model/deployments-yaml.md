`targets` declares the [Deployment Targets](/docs/concepts/deployments/) Services run on, nested as they nest, and `deployments` lists each Service in each Environment on a Target, with its URLs. They can sit in any file of a Project; `deployments.yaml` is a convention.

## Example

The [Kitchen sink](/docs/examples/kitchen-sink/)'s: a cluster inside a region, and a Deployment of each Service, the API's with a health endpoint:

```yaml file="examples/kitchen-sink/archidocs/sink/deployments.yaml"
```

See [Add Deployments](/docs/guides/model/add-deployments/).

## Fields
