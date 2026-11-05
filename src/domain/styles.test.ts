import { describe, expect, it } from "vitest";
import { buildModel, docs, res } from "../../tests/helpers/model";
import { resolveDiagram } from "./diagram-resolve";
import { parseResources } from "./parse";
import {
  elementStyleSchema,
  entitySchema,
  entityTypeSchema,
  relationshipSetSchema,
  relationshipStyleSchema,
  relationshipTypeSchema,
} from "./schema/resource-schemas";
import { ELEMENT_SHAPES, LINE_STYLES, STYLE_COLORS } from "./resources";
import {
  DEFAULT_ELEMENT_STYLE,
  DEFAULT_RELATIONSHIP_STYLE,
  effectiveElementStyle,
  effectiveRelationshipStyle,
} from "./styles";

const H = { apiVersion: "archdocs/v1" } as const;

describe("ADD-004 style schema", () => {
  it("accepts every documented shape, colour and line", () => {
    for (const shape of ELEMENT_SHAPES)
      expect(elementStyleSchema.safeParse({ shape }).success, shape).toBe(true);
    for (const color of STYLE_COLORS) {
      expect(elementStyleSchema.safeParse({ color }).success, color).toBe(true);
      expect(relationshipStyleSchema.safeParse({ color }).success, color).toBe(true);
    }
    for (const line of LINE_STYLES)
      expect(relationshipStyleSchema.safeParse({ line }).success, line).toBe(true);
    expect(elementStyleSchema.safeParse({}).success).toBe(true);
  });

  it("rejects unknown keys and values (strict, SCHEMA-08)", () => {
    expect(elementStyleSchema.safeParse({ shape: "hexagon" }).success).toBe(false);
    expect(elementStyleSchema.safeParse({ color: "#ff0000" }).success).toBe(false);
    expect(elementStyleSchema.safeParse({ line: "dashed" }).success).toBe(false);
    expect(relationshipStyleSchema.safeParse({ shape: "person" }).success).toBe(false);
    expect(relationshipStyleSchema.safeParse({ line: "wavy" }).success).toBe(false);
    expect(elementStyleSchema.safeParse({ icon: "aws" }).success).toBe(false);
  });

  it("is allowed on EntityType, Entity, EntitySet items, RelationshipType and RelationshipSet items", () => {
    expect(
      entityTypeSchema.safeParse({
        ...H,
        kind: "EntityType",
        id: "db",
        name: "DB",
        style: { shape: "cylinder", color: "indigo" },
      }).success,
    ).toBe(true);
    expect(
      entitySchema.safeParse({
        ...H,
        kind: "Entity",
        id: "e",
        name: "E",
        type: "t",
        style: { color: "red" },
      }).success,
    ).toBe(true);
    expect(
      relationshipTypeSchema.safeParse({
        ...H,
        kind: "RelationshipType",
        id: "r",
        name: "R",
        style: { line: "solid", color: "amber" },
      }).success,
    ).toBe(true);
    expect(
      relationshipSetSchema.safeParse({
        ...H,
        kind: "RelationshipSet",
        id: "rs",
        relationships: [
          { id: "r", type: "t", source: "a", target: "b", style: { line: "dotted" } },
        ],
      }).success,
    ).toBe(true);
    const set = parseResources(
      res("EntitySet", "id: s\nentities:\n  - {id: e, name: E, type: t, style: {shape: queue}}"),
      "s.yaml",
    );
    expect(set.diagnostics).toEqual([]);
  });

  it("reports a schema diagnostic for an invalid style in YAML", () => {
    const { diagnostics } = parseResources(
      res("EntityType", "id: t\nname: T\nstyle:\n  shape: blob"),
      "t.yaml",
    );
    expect(diagnostics.map((d) => d.code)).toContain("SCHEMA_INVALID_VALUE");
  });
});

const TYPES = docs(
  res("EntityType", "id: container\nname: Container\nstyle: {color: blue}"),
  res("EntityType", "id: database\nname: Database\nextends: container\nstyle: {shape: cylinder}"),
  res("EntityType", "id: ledger\nname: Ledger\nextends: database\nstyle: {color: indigo}"),
  res("EntityType", "id: plain\nname: Plain"),
  res("RelationshipType", "id: calls\nname: Calls\nstyle: {line: solid}"),
  res("RelationshipType", "id: calls-async\nname: Async\nextends: calls\nstyle: {color: amber}"),
  res("RelationshipType", "id: uses\nname: Uses"),
);

function model() {
  return buildModel({
    "types.yaml": TYPES,
    "e.yaml": res(
      "EntitySet",
      `id: es
entities:
  - {id: api, name: API, type: container}
  - {id: db, name: DB, type: database}
  - {id: ledger, name: Ledger, type: ledger}
  - {id: special, name: Special, type: ledger, style: {shape: storage}}
  - {id: x, name: X, type: plain}`,
    ),
    "r.yaml": res(
      "RelationshipSet",
      `id: rs
relationships:
  - {id: a, type: calls, source: api, target: db}
  - {id: b, type: calls-async, source: api, target: ledger}
  - {id: c, type: calls-async, source: api, target: special, style: {line: dotted, color: red}}
  - {id: d, type: uses, source: x, target: api}`,
    ),
  }).model;
}

describe("DIAG-11 effective style resolution", () => {
  it("falls back to built-in defaults", () => {
    const m = model();
    expect(effectiveElementStyle(m, m.entities.x!)).toEqual(DEFAULT_ELEMENT_STYLE);
    expect(effectiveRelationshipStyle(m, m.relationships.d!)).toEqual(DEFAULT_RELATIONSHIP_STYLE);
    expect(DEFAULT_ELEMENT_STYLE).toEqual({ shape: "rectangle", color: "primary" });
    expect(DEFAULT_RELATIONSHIP_STYLE).toEqual({ line: "dashed", color: "gray" });
  });

  it("inherits per key through the type chain, nearest type winning", () => {
    const m = model();
    expect(effectiveElementStyle(m, m.entities.api!)).toEqual({
      shape: "rectangle",
      color: "blue",
    });
    expect(effectiveElementStyle(m, m.entities.db!)).toEqual({ shape: "cylinder", color: "blue" });
    expect(effectiveElementStyle(m, m.entities.ledger!)).toEqual({
      shape: "cylinder",
      color: "indigo",
    });
    expect(effectiveRelationshipStyle(m, m.relationships.b!)).toEqual({
      line: "solid",
      color: "amber",
    });
  });

  it("applies the element's own style last", () => {
    const m = model();
    expect(effectiveElementStyle(m, m.entities.special!)).toEqual({
      shape: "storage",
      color: "indigo",
    });
    expect(effectiveRelationshipStyle(m, m.relationships.c!)).toEqual({
      line: "dotted",
      color: "red",
    });
  });

  it("tolerates unknown and cyclic types without looping", () => {
    const m = model();
    expect(effectiveElementStyle(m, { type: "missing" })).toEqual(DEFAULT_ELEMENT_STYLE);
    const cyclic = {
      entityTypes: {
        a: { id: "a", name: "A", extends: "b", style: { color: "red" as const } },
        b: { id: "b", name: "B", extends: "a", style: { shape: "queue" as const } },
      },
    };
    expect(effectiveElementStyle(cyclic, { type: "a" })).toEqual({ shape: "queue", color: "red" });
  });

  it("gives every view instance of an entity the same style (DIAG-09)", () => {
    const m = buildModel({
      "types.yaml": TYPES,
      "e.yaml": res("Entity", "id: db\nname: DB\ntype: database"),
      "d.yaml": res(
        "Diagram",
        "id: d\nname: D\ndiagramType: custom\nnodes:\n  - {id: db1, entity: db}\n  - {id: db2, entity: db}",
      ),
    }).model;
    const { diagram } = resolveDiagram(m, "d");
    expect(diagram!.nodes.map((n) => n.style)).toEqual([
      { shape: "cylinder", color: "blue" },
      { shape: "cylinder", color: "blue" },
    ]);
  });
});

describe("style merging", () => {
  it("treats explicitly undefined keys as not set", () => {
    expect(
      effectiveElementStyle(
        { entityTypes: {} },
        { type: "x", style: { shape: undefined, color: "red" } },
      ),
    ).toEqual({ shape: "rectangle", color: "red" });
  });
});
