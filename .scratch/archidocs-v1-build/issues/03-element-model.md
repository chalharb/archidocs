# 03: Full Element model

Status: ready-for-agent
Blocked by: 01
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Authors can declare the whole logical Element tree, and the Bundle carries it.

- **Kinds:** Person, System, Service and Component. Nesting is strict: `people`, `systems > services > components`, and top-level `services`.
- **Attaching across files:** `in: <id>` attaches a Service or Component to a parent declared in another file.
- **Common fields:** id, name, description, Owner (defaulting to the Project's Owner), tags, links.
- **Kind fields:** Service `type`, `technology`, `external`; System `external`; Component `technology`.
- **Rules:** `invalid-nesting`, `external-with-components`, and `duplicate-id` across files.
- **Bundle:** Elements carry `kind`, `parent` and the effective Owner.
- **Editors:** a JSON Schema generated from the zod types and shipped for the `yaml-language-server` `$schema` comment.

## Acceptance criteria

- [ ] A fixture spread over several files, using `in:`, builds the expected Element tree.
- [ ] Re-parenting an Element keeps its id.
- [ ] Every new rule has failing and passing fixtures.
- [ ] The generated JSON Schema validates the fixture's YAML and rejects an unknown key.
