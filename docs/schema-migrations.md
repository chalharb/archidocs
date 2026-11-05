# Schema migrations

How Architecture Docs upgrades YAML written for an older `apiVersion`, and why
canonical IDs can never change in the process (SCHEMA-10). Implementation:
[`src/domain/migrate.ts`](../src/domain/migrate.ts).

## Today

`archdocs/v1` is the only version, so the registry (`MIGRATIONS`) is empty and
any other `apiVersion` is reported as `SCHEMA_UNSUPPORTED_VERSION` (SCHEMA-07).
The mechanism below is in place and tested, so the first new version only has
to add a migration.

## How a migration works

A migration is one step between adjacent versions:

```ts
interface Migration {
  from: string; // e.g. "archdocs/v1"
  to: string; // e.g. "archdocs/v2"
  migrate(doc: RawDocument): RawDocument; // pure; receives a private copy
  canonicalIds(doc: RawDocument): string[]; // reads IDs from the `from` format
}
```

When a document's `apiVersion` isn't current, the loader finds the chain of
steps to the current version and applies them one by one, in memory. The
upgraded document is then validated against the current strict schema like
any other. Files on disk are never rewritten by a migration; an info
diagnostic (`SCHEMA_MIGRATED`) suggests updating the file.

## The ID guarantee

After every step, the guard compares the document's canonical IDs before and
after, using each version's own `canonicalIds` reader. IDs are compared as a
multiset of category-qualified keys:

| Category                                                            | Taken from (v1)                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `workspace`, `project`, `entityType`, `relationshipType`, `diagram` | the resource's `id`                                                  |
| `entity`                                                            | `Entity.id` and each `EntitySet.entities[].id`                       |
| `relationship`                                                      | each `RelationshipSet.relationships[].id`                            |
| `collection`                                                        | `EntitySet.id`, `RelationshipSet.id`                                 |
| `node:<diagram>`, `edge:<diagram>`                                  | diagram node/edge IDs, including defaults (`entity`, `relationship`) |
| `layout`, `layoutNode:<diagram>`, `layoutEdge:<diagram>`            | `DiagramLayout.diagram` and its override keys                        |

Categories rather than kinds are used, so a migration may restructure
resources (for example, merge `Entity` files into an `EntitySet`) as long as
the IDs are unchanged. If any ID is added, dropped, renamed, or its duplicate
count changes, the migration fails with `SCHEMA_MIGRATION_FAILED`, the
document is not loaded, and the error lists the lost and added keys. A step
that throws, or that doesn't produce the declared `to` version, fails the
same way.

Because the workspace keeps its last valid model when a reload fails
(RELI-04), a broken migration can't replace a working model.

## Adding a version

1. Write an addendum describing the `archdocs/vN` change.
2. Add the new schema and make it the current `API_VERSION`.
3. Register a `Migration` from the previous version, with a `canonicalIds`
   reader for the previous format.
4. Add tests: a fixture in the old format loads to the same canonical model as
   its hand-written new-format equivalent, and the guard rejects a deliberately
   ID-changing variant. `src/domain/migrate.test.ts` shows both patterns with
   a sample `archdocs/v0` format.

## Tests

`src/domain/migrate.test.ts` covers ID extraction for every kind, path finding
(chains, missing routes, cycles), the guard (renames, drops, merged
duplicates, throwing and wrong-version steps, plus a property test that any
single rename or drop in a set is caught), input immutability, and end-to-end
parsing of a migrated document.
