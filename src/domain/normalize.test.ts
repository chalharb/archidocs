import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE_TYPES, docs, parseFiles, res } from "../../tests/helpers/model";
import { normalize, toCanonicalEntity } from "./normalize";
import type { ParsedResource } from "./resources";

const ENTITY_FIELDS = `id: api
name: Payments API
type: container
description: Handles payments
parent: payments
project: core
technology: Node.js
owner: team-payments
tags: [critical, pci]
properties:
  tier: 1
  links: {runbook: "https://example.com"}`;

describe("TEST-02 normalization: individual vs grouped entities (SCHEMA-02, MODEL-03)", () => {
  it("normalizes Entity and EntitySet entries to identical representations", () => {
    const single = normalize(parseFiles({ "a.yaml": res("Entity", ENTITY_FIELDS) })).model;
    const grouped = normalize(
      parseFiles({
        "a.yaml": res(
          "EntitySet",
          `id: set\nentities:\n${ENTITY_FIELDS.replace(/^/gm, "    ").replace(/^    /, "  - ")}`,
        ),
      }),
    ).model;
    expect(grouped.entities.api).toEqual(single.entities.api);
    expect(JSON.stringify(grouped.entities)).toBe(JSON.stringify(single.entities));
  });

  it("fills defaults identically for minimal entities", () => {
    const single = normalize(
      parseFiles({ "a.yaml": res("Entity", "id: x\nname: X\ntype: t") }),
    ).model;
    const grouped = normalize(
      parseFiles({ "a.yaml": res("EntitySet", "id: s\nentities:\n  - {id: x, name: X, type: t}") }),
    ).model;
    expect(single.entities.x).toEqual({ id: "x", name: "X", type: "t", tags: [], properties: {} });
    expect(grouped.entities.x).toEqual(single.entities.x);
  });

  it("records provenance outside the canonical item", () => {
    const { model } = normalize(
      parseFiles({
        "set.yaml": res("EntitySet", "id: s\nname: S\nentities:\n  - {id: x, name: X, type: t}"),
      }),
    );
    expect(model.sources["entity:x"]).toEqual({
      file: "set.yaml",
      document: 0,
      path: ["entities", 0],
    });
    expect(model.collections.s).toEqual({ id: "s", kind: "EntitySet", name: "S", members: ["x"] });
  });

  it("does not share mutable arrays with the parsed input", () => {
    const fields = { id: "a", name: "A", type: "t", tags: ["x"], properties: { k: 1 } };
    const canonical = toCanonicalEntity(fields);
    canonical.tags.push("y");
    canonical.properties.k = 2;
    expect(fields).toEqual({ id: "a", name: "A", type: "t", tags: ["x"], properties: { k: 1 } });
  });
});

describe("TEST-02 normalization: all kinds", () => {
  it("normalizes every resource kind", () => {
    const { model, diagnostics } = normalize(
      parseFiles({
        "workspace.yaml": res(
          "Workspace",
          "id: ws\nname: WS\ndefaults:\n  layout: {direction: RIGHT}",
        ),
        "project.yaml": res("Project", "id: core\nname: Core"),
        "types.yaml": BASE_TYPES,
        "entities.yaml": docs(
          res("Entity", "id: web\nname: Web\ntype: container"),
          res("Entity", "id: db\nname: DB\ntype: database"),
        ),
        "rels.yaml": res(
          "RelationshipSet",
          "id: rels\nrelationships:\n  - {id: r1, type: reads, source: web, target: db}",
        ),
        "d.yaml": res(
          "Diagram",
          "id: d\nname: D\ndiagramType: c4-container\nlayout: {edgeType: step}\nnodes:\n  - entity: web\n  - {id: db-1, entity: db, label: Primary}\nedges:\n  - relationship: r1\n    target: db-1",
        ),
        "d.layout.yaml": res(
          "DiagramLayout",
          "diagram: d\nnodes:\n  web: {x: 1, y: 2}\n  db-1: {x: 3, y: 4}",
        ),
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(model.workspace).toEqual({
      id: "ws",
      name: "WS",
      layoutDefaults: { direction: "RIGHT" },
    });
    expect(model.projects.core).toEqual({ id: "core", name: "Core", tags: [], properties: {} });
    expect(model.entityTypes.database).toEqual({
      id: "database",
      name: "Database",
      extends: "container",
    });
    expect(model.relationshipTypes.reads).toEqual({
      id: "reads",
      name: "Reads from",
      sources: ["container"],
      targets: ["database"],
    });
    expect(model.relationships.r1).toEqual({
      id: "r1",
      type: "reads",
      source: "web",
      target: "db",
      tags: [],
      properties: {},
    });
    expect(model.diagrams.d).toEqual({
      id: "d",
      name: "D",
      diagramType: "c4-container",
      layout: { edgeType: "step" },
      nodes: [
        { id: "web", entity: "web" },
        { id: "db-1", entity: "db", label: "Primary" },
      ],
      edges: [{ id: "r1", relationship: "r1", target: "db-1" }],
    });
    expect(Object.keys(model.layouts.d!.nodes)).toEqual(["db-1", "web"]);
    expect(model.collections.rels).toEqual({
      id: "rels",
      kind: "RelationshipSet",
      members: ["r1"],
    });
  });
});

describe("TEST-03 duplicates (SCHEMA-03, SCHEMA-04)", () => {
  it("reports duplicate entity IDs across Entity and EntitySet; first by file wins", () => {
    const { model, diagnostics } = normalize(
      parseFiles({
        "b.yaml": res("Entity", "id: x\nname: From B\ntype: t"),
        "a.yaml": res("EntitySet", "id: s\nentities:\n  - {id: x, name: From A, type: t}"),
      }),
    );
    expect(model.entities.x!.name).toBe("From A");
    expect(model.collections.s!.members).toEqual(["x"]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "ID_DUPLICATE",
        file: "b.yaml",
        path: ["id"],
        related: [{ file: "a.yaml", document: 0, path: ["entities", 0] }],
      }),
    ]);
  });

  it("excludes losing duplicates from collection membership", () => {
    const { model } = normalize(
      parseFiles({
        "a.yaml": res("Entity", "id: x\nname: X\ntype: t"),
        "b.yaml": res(
          "EntitySet",
          "id: s\nentities:\n  - {id: x, name: X2, type: t}\n  - {id: y, name: Y, type: t}",
        ),
      }),
    );
    expect(model.collections.s!.members).toEqual(["y"]);
  });

  it.each([
    [
      "relationship",
      "RelationshipSet",
      "id: rs\nrelationships:\n  - {id: r, type: u, source: a, target: b}",
      "id: rs2\nrelationships:\n  - {id: r, type: u, source: a, target: b}",
      "ID_DUPLICATE",
      ["relationships", 0, "id"],
    ],
    [
      "diagram",
      "Diagram",
      "id: d\nname: D\ndiagramType: custom\nnodes: []",
      "id: d\nname: D\ndiagramType: custom\nnodes: []",
      "ID_DUPLICATE",
      ["id"],
    ],
    ["entity type", "EntityType", "id: t\nname: T", "id: t\nname: T", "ID_DUPLICATE", ["id"]],
    [
      "relationship type",
      "RelationshipType",
      "id: t\nname: T",
      "id: t\nname: T",
      "ID_DUPLICATE",
      ["id"],
    ],
    ["project", "Project", "id: p\nname: P", "id: p\nname: P", "ID_DUPLICATE", ["id"]],
    ["workspace", "Workspace", "id: w\nname: W", "id: w2\nname: W2", "WORKSPACE_DUPLICATE", ["id"]],
    ["layout", "DiagramLayout", "diagram: d", "diagram: d", "LAYOUT_DUPLICATE", ["diagram"]],
  ] as const)("reports duplicate %s", (_label, kind, first, second, code, path) => {
    const { diagnostics } = normalize(
      parseFiles({ "1.yaml": res(kind, first), "2.yaml": res(kind, second) }),
    );
    expect(diagnostics).toEqual([expect.objectContaining({ code, file: "2.yaml", path })]);
  });

  it("reports EntitySet/RelationshipSet collection ID conflicts (SCHEMA-04)", () => {
    const { diagnostics, model } = normalize(
      parseFiles({
        "a.yaml": res("EntitySet", "id: core\nentities: []"),
        "b.yaml": res("RelationshipSet", "id: core\nrelationships: []"),
      }),
    );
    expect(model.collections.core!.kind).toBe("EntitySet");
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "COLLECTION_ID_CONFLICT", file: "b.yaml" }),
    ]);
  });

  it("allows the same ID in different categories", () => {
    const { diagnostics } = normalize(
      parseFiles({
        "a.yaml": docs(
          res("EntityType", "id: api\nname: API"),
          res("Entity", "id: api\nname: API\ntype: api"),
          res("Diagram", "id: api\nname: API\ndiagramType: custom\nnodes: []"),
        ),
      }),
    );
    expect(diagnostics).toEqual([]);
  });
});

describe("TEST-02 file-order independence and stable IDs (SCHEMA-09, MODEL-08)", () => {
  const files = {
    "z/last.yaml": docs(
      res("Entity", "id: x\nname: X from z\ntype: t"),
      res("Entity", "id: b\nname: B\ntype: t\nparent: a"),
    ),
    "a/first.yaml": docs(
      res("Entity", "id: a\nname: A\ntype: t"),
      res("Entity", "id: x\nname: X from a\ntype: t"),
    ),
    "m/mid.yaml": res(
      "EntitySet",
      "id: s\nentities:\n  - {id: c, name: C, type: t}\n  - {id: x, name: X from m, type: t}",
    ),
    "m/types.yaml": res("EntityType", "id: t\nname: T"),
  };
  const parsed = parseFiles(files);

  it("produces identical models and diagnostics for any input order", () => {
    const reference = normalize(parsed);
    fc.assert(
      fc.property(
        fc.shuffledSubarray(parsed, { minLength: parsed.length, maxLength: parsed.length }),
        (shuffled) => {
          const result = normalize(shuffled as ParsedResource[]);
          expect(JSON.stringify(result)).toBe(JSON.stringify(reference));
        },
      ),
      { numRuns: 200 },
    );
    expect(reference.model.entities.x!.name).toBe("X from a");
  });

  it("emits records in sorted key order", () => {
    const { model } = normalize([...parsed].reverse());
    expect(Object.keys(model.entities)).toEqual(["a", "b", "c", "x"]);
  });

  it("keeps canonical IDs exactly as authored", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,20}$/), (id) => {
        const { model } = normalize(
          parseFiles({ "f.yaml": res("Entity", `id: "${id}"\nname: N\ntype: t`) }),
        );
        expect(Object.keys(model.entities)).toEqual([id]);
        expect(model.entities[id]!.id).toBe(id);
      }),
      { numRuns: 100 },
    );
  });
});
