# 10: Model YAML reference that explains every field

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

On the six Model YAML reference pages, 158 of 224 field rows have an empty Notes column, and `model-yaml` repeats the eight Relationship fields under every kind and nesting level.

- **Descriptions:** give every field in `src/schema/workspace.ts` and `src/schema/adr.ts` a description, with its default and what its values mean (`type: app | datastore | broker`, `interaction: sync | async`). Regenerate `schemas/*.schema.json` with `pnpm schemas`. Editors then show the same text on hover.
- **Shared shapes once:** `website/src/reference/json-schema.ts` renders a shape used in several places as its own section ("Common Element fields", "Relationship", "Link") and links to it from each place it is used.
- **Columns:** Field, Type, Required, Default, Description.
- **Constraints:** state the id pattern and other limits the schema enforces.

Write the descriptions in the Glossary's terms. Don't change what the schemas accept.

## Acceptance criteria

- [ ] A unit test fails when a schema property has no description.
- [ ] No row on any Model YAML page has an empty description.
- [ ] The Relationship fields are listed once on `model-yaml`.
- [ ] Every file in `examples/` and `website/samples/` validates as before.
- [ ] The generated `schemas/` are committed and match `pnpm schemas`.
