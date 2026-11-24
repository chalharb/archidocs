A `project.yaml` marks its folder as a [Project](/docs/concepts/workspace-and-projects/). Every other `.yaml` file in the folder, whatever its name, is part of that Project's Model, and everything declared there is owned by the Project's `owner` unless it says otherwise. Projects don't nest.

## Example

The [Kitchen sink](/docs/examples/kitchen-sink/)'s:

```yaml file="examples/kitchen-sink/archidocs/sink/project.yaml"
```

`id` is how other Projects name this one's Elements, as `sink:api`. See [Add a Project](/docs/guides/model/add-a-project/).

## Fields
