Any `.yaml` file in a Project folder other than `project.yaml` can declare [Elements](/docs/concepts/elements/) under `people`, `systems`, `services` and `components`, and the [Relationships](/docs/concepts/relationships/) of each under its `relationships`. The same files also hold [Deployment Targets and Deployments](/docs/reference/model/deployments-yaml/) and [Saved Views](/docs/reference/model/views-yaml/), so a Project can keep everything in one file or split it however it likes.

## Example

The [Kitchen sink](/docs/examples/kitchen-sink/) declares one of every kind of Element: a Person, an internal System with an app, a datastore and a broker Service, Components, an async Relationship through the broker, an External System, and Services outside any System:

```yaml file="examples/kitchen-sink/archidocs/sink/model.yaml"
```

A Service declared in another file joins a System with `in`:

```yaml file="examples/kitchen-sink/archidocs/sink/reporting.yaml"
```

## Fields
