An [ADR](/docs/concepts/decisions/) is a Markdown file named `NNNN-slug.md` in a Project's `adr/` folder. Its YAML frontmatter gives its status and links it to the Elements, Deployment Targets and Saved Views it affects; the body is free Markdown under one `#` title.

## Example

The [Kitchen sink](/docs/examples/kitchen-sink/)'s:

```markdown file="examples/kitchen-sink/archidocs/sink/adr/0001-send-receipts-from-order-events.md"
```

`superseded` is never written by hand: list the old ADR in the new one's `supersedes`. See [Record an ADR](/docs/guides/model/record-an-adr/).

## Fields
