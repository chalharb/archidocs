`views` holds a Project's [Saved Views](/docs/concepts/views/): `structural` ones, picked by selectors and drawn at a `level` (`deployment` for a Deployment View), and `dynamic` ones, a scenario as Steps. Each View's id is unique among the Project's Views, and others name it as `project:id`.

## Example

The [Kitchen sink](/docs/examples/kitchen-sink/)'s: a structural View that opens a System, one that selects everything upstream of a datastore, leaves out a Person and opens with the Impact Lens, and a Dynamic View with a call, a derived edge, an event and a reply:

```yaml file="examples/kitchen-sink/archidocs/sink/views.yaml"
```

See [Save a View](/docs/guides/model/save-a-view/) and [Write a Dynamic View](/docs/guides/model/write-a-dynamic-view/).

## Fields
