# 10: Model YAML reference that explains every field

Status: done
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

- [x] A unit test fails when a schema property has no description.
- [x] No row on any Model YAML page has an empty description.
- [x] The Relationship fields are listed once on `model-yaml`.
- [x] Every file in `examples/` and `website/samples/` validates as before.
- [x] The generated `schemas/` are committed and match `pnpm schemas`.

## Comments

### Build notes (2026-11-24)

- **Descriptions:** every property in `src/schema/workspace.ts` and `src/schema/adr.ts` has a `.describe(…)`, as does each map entry (a Team, a Deployment, a Step) and each alternative of a union. Enum fields say what each value means. `test/schema/descriptions.test.ts` fails on a property without a description, an enum value its description doesn't mention, or a misplaced default.
- **Defaults:** a default is the closing sentence of the description, `Default: ….`, so an editor's hover shows it; the reference moves it to the Default column (`splitDefault`). The JSON Schema `default` keyword is not used: `yaml-language-server` inserts every property that has one when it completes an object, which would write `type: app` and `external: false` into people's files. Defaults were read from the code: `type` and `interaction` in `src/core/load.ts`, a Lens's `direction` there too, `paths` in `src/core/saved-views.ts`, a View's `direction` in `src/render/layout.ts` (`LR`) and `src/core/deployment-views.ts` (`TB`).
- **Shared shapes:** Person, System, Service, Component, Relationship, Link, Selector, Path selector and Lens now have a zod `id` (as Target had), so the JSON Schemas define each once under `$defs` and `$ref` it. `model.schema.json` went from 1381 lines to 874. What the schemas accept is unchanged: every file in `examples/` and `website/samples/` (63) validates the same, and 6016 one-change mutations of them (an unknown key, a removed key, a wrong type, a bad slug) get the same result from the old and new schemas.
- **Pages:** `describedRows` and `describedShape` in `website/src/reference/json-schema.ts` link a `$defs` shape instead of expanding it. `model.ts` lists a shape under the key that holds it (`services` for Service, `targets` for Deployment Target) or in a section of its own (Relationship, Link, Selector, Path selector, Lens), and works out "Common Element fields" as the properties the four kinds define identically. A union (Selector, Lens) is shown as its alternatives, each with its own table.
- **Types and limits:** the Type column says `id`, `reference`, `ADR reference`, `URL` or `date`, and each page explains the ones it uses once, with the pattern. A minimum is part of the type (`integer ≥ 1`). Each page names the rule an unlisted key breaks.
- **Rows:** 224 rows with 158 empty before; 119 rows with none empty after. `model-yaml` went from 134 rows to 33.
- **MCP reference:** `fieldRows`, `fieldTable` and `typeName` are untouched, and the two MCP pages render byte for byte as before. The new functions are there for ticket 12 to use.
- **Not established from the repo:** nothing in the code, Glossary or guide says what an ADR's `deprecated` status means beyond "can be superseded"; its description takes the MADR sense, "no longer in force, with no ADR replacing it". `links` are kept in the Bundle and returned over MCP but the viewer doesn't show them, so their descriptions don't say where they appear.
- **Tests in a new file:** the page tests are in `website/test/model-reference.test.ts`, not `reference.test.ts`, to stay out of the way of the other tickets editing that file.
