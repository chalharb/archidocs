import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { res } from "../../tests/helpers/model";
import {
  MIGRATIONS,
  MigrationError,
  canonicalIdsV1,
  migrateDocument,
  migrationPath,
  type Migration,
  type RawDocument,
} from "./migrate";
import { normalize } from "./normalize";
import { parseResources } from "./parse";
import { API_VERSION } from "./resources";

/**
 * A plausible legacy format: Kubernetes-style `metadata`, and `entityType`
 * instead of `type`. Used only to exercise the migration machinery.
 */
type V0 = RawDocument & { metadata?: { id?: unknown; name?: unknown }; entities?: RawDocument[] };
const v0Ids = (doc: RawDocument): string[] => {
  const d = doc as V0;
  const flat = {
    ...d,
    apiVersion: API_VERSION,
    id: d.metadata?.id,
    ...(d.entities ? { entities: d.entities.map(flattenEntity) } : {}),
  };
  return canonicalIdsV1(flat);
};
function flattenEntity(e: RawDocument): RawDocument {
  const { metadata, entityType, ...rest } = e as V0 & { entityType?: unknown };
  return { ...rest, id: metadata?.id, name: metadata?.name, type: entityType };
}
const v0ToV1: Migration = {
  from: "archdocs/v0",
  to: API_VERSION,
  canonicalIds: v0Ids,
  migrate(doc) {
    const d = doc as V0;
    if (d.kind === "EntitySet") {
      return {
        apiVersion: API_VERSION,
        kind: "EntitySet",
        id: d.metadata?.id,
        entities: (d.entities ?? []).map(flattenEntity),
      };
    }
    const {
      metadata: _m,
      apiVersion: _v,
      ...rest
    } = flattenEntity(d) as RawDocument & { metadata?: unknown };
    return { ...rest, apiVersion: API_VERSION };
  },
};

const V0_ENTITY =
  "apiVersion: archdocs/v0\nkind: Entity\nmetadata: {id: api, name: API}\nentityType: container\n";
const V1_ENTITY = res("Entity", "id: api\nname: API\ntype: container");

describe("canonicalIdsV1", () => {
  it.each([
    [{ kind: "Workspace", id: "w" }, ["workspace:w"]],
    [{ kind: "Project", id: "p" }, ["project:p"]],
    [{ kind: "EntityType", id: "t" }, ["entityType:t"]],
    [{ kind: "RelationshipType", id: "r" }, ["relationshipType:r"]],
    [{ kind: "Entity", id: "e" }, ["entity:e"]],
    [
      { kind: "EntitySet", id: "s", entities: [{ id: "b" }, { id: "a" }] },
      ["collection:s", "entity:a", "entity:b"],
    ],
    [
      { kind: "RelationshipSet", id: "rs", relationships: [{ id: "r1" }] },
      ["collection:rs", "relationship:r1"],
    ],
    [
      {
        kind: "Diagram",
        id: "d",
        nodes: [{ entity: "a" }, { id: "a2", entity: "a" }],
        edges: [{ relationship: "r" }, { id: "e2", relationship: "r" }],
      },
      ["diagram:d", "edge:d:e2", "edge:d:r", "node:d:a", "node:d:a2"],
    ],
    [
      { kind: "DiagramLayout", diagram: "d", nodes: { a: {} }, edges: { r: {} } },
      ["layout:d", "layoutEdge:d:r", "layoutNode:d:a"],
    ],
  ])("extracts IDs from %j", (doc, expected) => {
    expect(canonicalIdsV1(doc as RawDocument)).toEqual(expected);
  });

  it("ignores malformed input instead of throwing", () => {
    expect(canonicalIdsV1({ kind: "EntitySet", id: 3, entities: "nope" })).toEqual([]);
    expect(canonicalIdsV1({ kind: "EntitySet", entities: [null, 1, { id: 2 }] })).toEqual([]);
    expect(canonicalIdsV1({ kind: "Diagram", nodes: [{ entity: "a" }] })).toEqual([]);
    expect(canonicalIdsV1({ kind: "DiagramLayout", diagram: "d", nodes: ["a"] })).toEqual([
      "layout:d",
    ]);
    expect(canonicalIdsV1({ kind: "Unknown", id: "x" })).toEqual([]);
  });

  it("keeps IDs stable when an entity moves between Entity and EntitySet", () => {
    expect(canonicalIdsV1({ kind: "Entity", id: "a" })).toEqual(
      canonicalIdsV1({ kind: "EntitySet", id: "s", entities: [{ id: "a" }] }).filter((k) =>
        k.startsWith("entity:"),
      ),
    );
  });
});

describe("migrationPath", () => {
  const step = (from: string, to: string): Migration => ({
    from,
    to,
    migrate: (d) => d,
    canonicalIds: () => [],
  });

  it("is empty for the current version", () => {
    expect(migrationPath(API_VERSION, [])).toEqual([]);
  });

  it("chains steps in order", () => {
    const a = step("archdocs/v0", "archdocs/v0.5");
    const b = step("archdocs/v0.5", API_VERSION);
    expect(migrationPath("archdocs/v0", [b, a])).toEqual([a, b]);
  });

  it("returns null without a route or on a cycle", () => {
    expect(migrationPath("archdocs/v0", [])).toBeNull();
    expect(migrationPath("archdocs/v2", [step("archdocs/v0", API_VERSION)])).toBeNull();
    expect(migrationPath("x", [step("x", "y"), step("y", "x")])).toBeNull();
  });

  it("every registered migration reaches the current version (registry invariant)", () => {
    for (const m of MIGRATIONS) expect(migrationPath(m.from)).not.toBeNull();
  });
});

describe("migrateDocument (SCHEMA-10)", () => {
  const entity = {
    apiVersion: "archdocs/v0",
    kind: "Entity",
    metadata: { id: "api", name: "API" },
    entityType: "container",
  };

  it("returns null when there is no path or no version", () => {
    expect(migrateDocument(entity, [])).toBeNull();
    expect(migrateDocument({ kind: "Entity" }, [v0ToV1])).toBeNull();
  });

  it("upgrades a document and preserves its IDs", () => {
    expect(migrateDocument(entity, [v0ToV1])).toEqual({
      apiVersion: API_VERSION,
      kind: "Entity",
      id: "api",
      name: "API",
      type: "container",
    });
  });

  it("does not mutate its input", () => {
    const input = structuredClone(entity);
    migrateDocument(input, [
      {
        ...v0ToV1,
        migrate: (d) => (((d.metadata as RawDocument).id = "api"), { ...v0ToV1.migrate(d) }),
      },
    ]);
    expect(input).toEqual(entity);
  });

  it("chains several steps, checking IDs at each", () => {
    const toMid: Migration = {
      from: "archdocs/v0",
      to: "archdocs/v0.5",
      canonicalIds: v0Ids,
      migrate: (d) => ({ ...d, apiVersion: "archdocs/v0.5" }),
    };
    const toV1: Migration = { ...v0ToV1, from: "archdocs/v0.5" };
    expect(migrateDocument(entity, [toMid, toV1])).toMatchObject({ id: "api", type: "container" });
  });

  it("rejects a migration that renames an ID", () => {
    const renaming: Migration = {
      ...v0ToV1,
      migrate: (d) => ({ ...v0ToV1.migrate(d), id: "payments-api" }),
    };
    const err = (() => {
      try {
        migrateDocument(entity, [renaming]);
      } catch (e) {
        return e as MigrationError;
      }
    })();
    expect(err).toBeInstanceOf(MigrationError);
    expect(err).toMatchObject({
      from: "archdocs/v0",
      to: API_VERSION,
      lost: ["entity:api"],
      added: ["entity:payments-api"],
    });
    expect(err!.message).toMatch(
      /changed canonical IDs; lost: entity:api; added: entity:payments-api/,
    );
  });

  it("rejects a migration that drops or duplicates set members", () => {
    const set = {
      apiVersion: "archdocs/v0",
      kind: "EntitySet",
      metadata: { id: "s" },
      entities: [{ metadata: { id: "a" } }, { metadata: { id: "b" } }],
    };
    const dropping: Migration = {
      ...v0ToV1,
      migrate: (d) => {
        const out = v0ToV1.migrate(d);
        return { ...out, entities: (out.entities as RawDocument[]).slice(0, 1) };
      },
    };
    expect(() => migrateDocument(set, [dropping])).toThrow(/lost: entity:b$/);
    const merging: Migration = {
      ...v0ToV1,
      migrate: (d) => {
        const out = v0ToV1.migrate(d);
        return { ...out, entities: [{ id: "a" }, { id: "a" }] };
      },
    };
    expect(() => migrateDocument(set, [merging])).toThrow(/lost: entity:b; added: entity:a/);
  });

  it("reports migrations that throw or produce the wrong version", () => {
    const throwing: Migration = {
      ...v0ToV1,
      migrate: () => {
        throw new Error("boom");
      },
    };
    expect(() => migrateDocument(entity, [throwing])).toThrow(
      /archdocs\/v0 → archdocs\/v1 failed: boom/,
    );
    const stuck: Migration = { ...v0ToV1, migrate: (d) => d };
    expect(() => migrateDocument(entity, [stuck])).toThrow(
      /did not produce an 'archdocs\/v1' document/,
    );
    const nothing: Migration = { ...v0ToV1, migrate: () => null as unknown as RawDocument };
    expect(() => migrateDocument(entity, [nothing])).toThrow(MigrationError);
  });

  it("catches any single renamed or dropped entity in a set (property)", () => {
    const ids = fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/), {
      minLength: 1,
      maxLength: 20,
    });
    fc.assert(
      fc.property(ids, fc.nat(), fc.boolean(), (list, pick, drop) => {
        const doc = {
          apiVersion: "archdocs/v0",
          kind: "EntitySet",
          metadata: { id: "s" },
          entities: list.map((id) => ({ metadata: { id } })),
        };
        expect(migrateDocument(doc, [v0ToV1])).not.toBeNull(); // faithful migration passes
        const victim = pick % list.length;
        const broken: Migration = {
          ...v0ToV1,
          migrate: (d) => {
            const out = v0ToV1.migrate(d);
            const entities = [...(out.entities as RawDocument[])];
            if (drop) entities.splice(victim, 1);
            else entities[victim] = { ...entities[victim], id: `${list[victim]}-renamed` };
            return { ...out, entities };
          },
        };
        expect(() => migrateDocument(doc, [broken])).toThrow(MigrationError);
      }),
    );
  });
});

describe("parsing with migrations", () => {
  it("loads an older document into the same canonical model as its current equivalent", () => {
    const old = parseResources(V0_ENTITY, "old.yaml", undefined, [v0ToV1]);
    const current = parseResources(V1_ENTITY, "old.yaml");
    expect(old.resources).toEqual(current.resources);
    expect(normalize(old.resources).model).toEqual(normalize(current.resources).model);
    expect(old.diagnostics).toEqual([
      expect.objectContaining({
        severity: "info",
        code: "SCHEMA_MIGRATED",
        path: ["apiVersion"],
        line: 1,
      }),
    ]);
  });

  it("validates the migrated document against the current schema", () => {
    const missingName =
      "apiVersion: archdocs/v0\nkind: Entity\nmetadata: {id: api}\nentityType: container\n";
    const codes = parseResources(missingName, "f.yaml", undefined, [v0ToV1]).diagnostics.map(
      (d) => d.code,
    );
    expect(codes).toEqual(["SCHEMA_MIGRATED", "SCHEMA_REQUIRED_FIELD"]);
  });

  it("refuses to load a document whose migration changes IDs", () => {
    const renaming: Migration = {
      ...v0ToV1,
      migrate: (d) => ({ ...v0ToV1.migrate(d), id: "other" }),
    };
    const { resources, diagnostics } = parseResources(V0_ENTITY, "f.yaml", undefined, [renaming]);
    expect(resources).toEqual([]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "SCHEMA_MIGRATION_FAILED",
        message: expect.stringContaining("lost: entity:api"),
      }),
    ]);
  });

  it("still reports unsupported versions when no migration applies (SCHEMA-07)", () => {
    expect(parseResources(V0_ENTITY, "f.yaml").diagnostics.map((d) => d.code)).toEqual([
      "SCHEMA_UNSUPPORTED_VERSION",
    ]);
  });
});
