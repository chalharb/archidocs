import { describe, expect, it } from "vitest";
import { BASE_TYPES, buildModel, docs, res } from "../../tests/helpers/model";
import { resolveDiagram } from "./diagram-resolve";

const ENTITIES = res(
  "EntitySet",
  `id: es
entities:
  - {id: user, name: User, type: person}
  - {id: api, name: Payments API, type: container, technology: Go, description: Takes payments, parent: sys}
  - {id: db, name: Ledger DB, type: database}
  - {id: sys, name: Payments, type: software-system}`,
);
const RELS = res(
  "RelationshipSet",
  `id: rs
relationships:
  - {id: user-api, type: uses, source: user, target: api, description: Pays with}
  - {id: api-db, type: reads, source: api, target: db, technology: SQL}
  - {id: db-user, type: uses, source: db, target: user}`,
);

function model(diagram: string) {
  return buildModel({
    "types.yaml": BASE_TYPES,
    "e.yaml": ENTITIES,
    "r.yaml": RELS,
    "d.yaml": res("Diagram", diagram),
  }).model;
}

describe("P0-07 diagram resolution", () => {
  it("resolves nodes and edges with canonical references (DIAG-08)", () => {
    const m = model(`id: d
name: Context
diagramType: c4-context
description: Overview
nodes:
  - entity: user
  - {entity: api, label: API}
edges:
  - relationship: user-api
  - {relationship: user-api, id: again, label: Custom}`);
    const { diagram, diagnostics } = resolveDiagram(m, "d");
    expect(diagnostics).toEqual([]);
    expect(diagram).toEqual({
      id: "d",
      name: "Context",
      diagramType: "c4-context",
      description: "Overview",
      nodes: [
        {
          id: "user",
          entityId: "user",
          label: "User",
          entityType: "person",
          style: { shape: "rectangle", color: "primary" },
        },
        {
          id: "api",
          entityId: "api",
          label: "API",
          entityType: "container",
          technology: "Go",
          description: "Takes payments",
          parentEntityId: "sys",
          style: { shape: "rectangle", color: "primary" },
        },
      ],
      edges: [
        {
          id: "user-api",
          relationshipId: "user-api",
          relationshipType: "uses",
          source: "user",
          target: "api",
          label: "Pays with",
          style: { line: "dashed", color: "gray" },
        },
        {
          id: "again",
          relationshipId: "user-api",
          relationshipType: "uses",
          source: "user",
          target: "api",
          label: "Custom",
          style: { line: "dashed", color: "gray" },
        },
      ],
    });
  });

  it("supports multiple view instances of one entity (DIAG-09)", () => {
    const m = model(`id: d
name: Replicas
diagramType: deployment
nodes:
  - {id: api-eu, entity: api}
  - {id: api-us, entity: api}
  - entity: db
edges:
  - {id: eu-db, relationship: api-db, source: api-eu}
  - {id: us-db, relationship: api-db, source: api-us, target: db}`);
    const { diagram, diagnostics } = resolveDiagram(m, "d");
    expect(diagnostics).toEqual([]);
    expect(diagram!.nodes.map((n) => [n.id, n.entityId])).toEqual([
      ["api-eu", "api"],
      ["api-us", "api"],
      ["db", "db"],
    ]);
    expect(diagram!.edges.map((e) => [e.id, e.source, e.target, e.technology])).toEqual([
      ["eu-db", "api-eu", "db", "SQL"],
      ["us-db", "api-us", "db", "SQL"],
    ]);
  });

  it("returns null for unknown diagrams", () => {
    expect(resolveDiagram(model("id: d\nname: D\ndiagramType: custom\nnodes: []"), "nope")).toEqual(
      {
        diagram: null,
        diagnostics: [],
      },
    );
  });

  describe("TEST-03 diagram endpoint mismatches", () => {
    const resolve = (diagram: string) => resolveDiagram(model(diagram), "d");
    const summary = (diagram: string) =>
      resolve(diagram).diagnostics.map((d) => [d.code, d.file, d.path]);

    it("reports nodes for unknown entities and drops them", () => {
      const { diagram, diagnostics } = resolve(
        "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: ghost}, {entity: user}]",
      );
      expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
        ["REF_MISSING", ["nodes", 0, "entity"]],
      ]);
      expect(diagram!.nodes.map((n) => n.id)).toEqual(["user"]);
    });

    it("reports duplicate node and edge IDs", () => {
      expect(
        summary(
          "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: user}, {entity: api, id: user}, {entity: api}]\nedges: [{relationship: user-api}, {relationship: user-api}]",
        ),
      ).toEqual([
        ["DIAGRAM_DUPLICATE_NODE", "d.yaml", ["nodes", 1, "id"]],
        ["DIAGRAM_DUPLICATE_EDGE", "d.yaml", ["edges", 1, "id"]],
      ]);
    });

    it("reports edges for unknown relationships", () => {
      expect(
        summary("id: d\nname: D\ndiagramType: custom\nnodes: []\nedges: [{relationship: nope}]"),
      ).toEqual([["REF_MISSING", "d.yaml", ["edges", 0, "relationship"]]]);
    });

    it("reports relationship endpoints that are not in the diagram", () => {
      const { diagnostics, diagram } = resolve(
        "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: user}]\nedges: [{relationship: user-api}]",
      );
      expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
        ["DIAGRAM_ENDPOINT_MISMATCH", ["edges", 0, "relationship"]],
      ]);
      expect(diagnostics[0]!.hint).toBe("Add a node for 'api' or remove this edge.");
      expect(diagram!.edges).toEqual([]);
    });

    it("reports explicit endpoints that show the wrong entity", () => {
      expect(
        summary(
          "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: user}, {entity: api}, {entity: db}]\nedges: [{relationship: user-api, target: db}]",
        ),
      ).toEqual([["DIAGRAM_ENDPOINT_MISMATCH", "d.yaml", ["edges", 0, "target"]]]);
    });

    it("reports explicit endpoints that are not nodes", () => {
      expect(
        summary(
          "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: user}, {entity: api}]\nedges: [{relationship: user-api, source: nobody}]",
        ),
      ).toEqual([["REF_MISSING", "d.yaml", ["edges", 0, "source"]]]);
    });

    it("reports ambiguous endpoints when an entity has several instances", () => {
      const { diagnostics } = resolve(
        "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: user}, {id: a1, entity: api}, {id: a2, entity: api}]\nedges: [{relationship: user-api}]",
      );
      expect(diagnostics).toEqual([
        expect.objectContaining({
          code: "DIAGRAM_ENDPOINT_AMBIGUOUS",
          path: ["edges", 0],
          hint: "Set 'target' to one of: a1, a2.",
        }),
      ]);
    });
  });

  it("is deterministic", () => {
    const m = model(
      "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: user}, {entity: api}, {entity: db}]\nedges: [{relationship: api-db}, {relationship: user-api}, {relationship: db-user}]",
    );
    expect(JSON.stringify(resolveDiagram(m, "d"))).toBe(
      JSON.stringify(resolveDiagram(structuredClone(m), "d")),
    );
  });

  it("resolves diagrams defined alongside other resources in multi-doc files", () => {
    const { model: m } = buildModel({
      "types.yaml": BASE_TYPES,
      "all.yaml": docs(
        res("Entity", "id: a\nname: A\ntype: actor"),
        res("Diagram", "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: ghost}]"),
      ),
    });
    expect(resolveDiagram(m, "d").diagnostics[0]).toMatchObject({ file: "all.yaml", document: 1 });
  });
});
