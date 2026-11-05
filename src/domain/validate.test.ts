import { describe, expect, it } from "vitest";
import { BASE_TYPES, buildModel, docs, res } from "../../tests/helpers/model";

const WS = res("Workspace", "id: ws\nname: WS");

function check(files: Record<string, string>) {
  return buildModel({ "workspace.yaml": WS, "types.yaml": BASE_TYPES, ...files }).diagnostics;
}
const codes = (files: Record<string, string>) => check(files).map((d) => d.code);

describe("TEST-03 validation", () => {
  it("accepts a valid model with no diagnostics", () => {
    expect(
      check({
        "p.yaml": res("Project", "id: core\nname: Core"),
        "e.yaml": docs(
          res("Entity", "id: sys\nname: Sys\ntype: software-system\nproject: core"),
          res("Entity", "id: api\nname: API\ntype: container\nparent: sys"),
          res("Entity", "id: db\nname: DB\ntype: database\nparent: sys"),
          res("Entity", "id: user\nname: User\ntype: person"),
        ),
        "r.yaml": res(
          "RelationshipSet",
          "id: rels\nrelationships:\n  - {id: r1, type: uses, source: user, target: api}\n  - {id: r2, type: reads, source: api, target: db}",
        ),
      }),
    ).toEqual([]);
  });

  it("warns when the Workspace resource is missing", () => {
    const { diagnostics } = buildModel({ "types.yaml": BASE_TYPES });
    expect(diagnostics.map((d) => d.code)).toEqual(["WORKSPACE_MISSING"]);
  });

  describe("missing references (MODEL-07)", () => {
    it("reports unknown entity type, parent and project with paths", () => {
      const ds = check({
        "e.yaml": res("Entity", "id: a\nname: A\ntype: nope\nparent: ghost\nproject: none"),
      });
      expect(ds.map((d) => [d.code, d.path])).toEqual([
        ["REF_MISSING", ["parent"]],
        ["REF_MISSING", ["project"]],
        ["REF_MISSING", ["type"]],
      ]);
      expect(ds.every((d) => d.file === "e.yaml")).toBe(true);
    });

    it("reports unknown relationship type and endpoints within a set", () => {
      const ds = check({
        "r.yaml": res(
          "RelationshipSet",
          "id: rs\nrelationships:\n  - {id: r, type: nope, source: x, target: y}",
        ),
      });
      expect(ds.map((d) => [d.code, d.path])).toEqual([
        ["REF_MISSING", ["relationships", 0, "source"]],
        ["REF_MISSING", ["relationships", 0, "target"]],
        ["REF_MISSING", ["relationships", 0, "type"]],
      ]);
    });

    it("reports unknown type parents and unknown allowed endpoint types", () => {
      expect(
        codes({
          "t.yaml": docs(
            res("EntityType", "id: orphan\nname: O\nextends: missing"),
            res(
              "RelationshipType",
              "id: rt\nname: RT\nextends: missing\nsources: [ghost]\ntargets: [actor]",
            ),
          ),
        }),
      ).toEqual(["REF_MISSING", "REF_MISSING", "REF_MISSING"]);
    });
  });

  describe("hierarchies (SCHEMA-05, MODEL-10)", () => {
    it("reports a parent cycle once, at its smallest member", () => {
      const ds = check({
        "e.yaml": docs(
          res("Entity", "id: c\nname: C\ntype: actor\nparent: a"),
          res("Entity", "id: a\nname: A\ntype: actor\nparent: b"),
          res("Entity", "id: b\nname: B\ntype: actor\nparent: c"),
        ),
      });
      expect(ds).toEqual([
        expect.objectContaining({
          code: "HIERARCHY_CYCLE",
          document: 1,
          path: ["parent"],
          message: "Parent hierarchy cycle: a → b → c → a",
        }),
      ]);
    });

    it("reports self-parenting", () => {
      expect(codes({ "e.yaml": res("Entity", "id: a\nname: A\ntype: actor\nparent: a") })).toEqual([
        "HIERARCHY_CYCLE",
      ]);
    });

    it("reports entity and relationship type inheritance cycles", () => {
      expect(
        codes({
          "t.yaml": docs(
            res("EntityType", "id: x\nname: X\nextends: y"),
            res("EntityType", "id: y\nname: Y\nextends: x"),
            res("RelationshipType", "id: rx\nname: RX\nextends: rx"),
          ),
        }),
      ).toEqual(["TYPE_INHERITANCE_CYCLE", "TYPE_INHERITANCE_CYCLE"]);
    });
  });

  describe("relationship endpoint types with inheritance (SCHEMA-06)", () => {
    const entities = res(
      "EntitySet",
      "id: es\nentities:\n  - {id: api, name: API, type: container}\n  - {id: db, name: DB, type: database}\n  - {id: user, name: U, type: person}",
    );
    const rel = (type: string, source: string, target: string) =>
      res(
        "RelationshipSet",
        `id: rs\nrelationships:\n  - {id: r, type: ${type}, source: ${source}, target: ${target}}`,
      );

    it("accepts subtypes of allowed endpoint types", () => {
      expect(codes({ "e.yaml": entities, "r.yaml": rel("reads", "db", "db") })).toEqual([]);
    });

    it("applies constraints inherited from a parent relationship type", () => {
      expect(codes({ "e.yaml": entities, "r.yaml": rel("reads-fast", "api", "db") })).toEqual([]);
      const ds = check({ "e.yaml": entities, "r.yaml": rel("reads-fast", "user", "api") });
      expect(ds.map((d) => [d.code, d.path])).toEqual([
        ["RELATIONSHIP_ENDPOINT_TYPE", ["relationships", 0, "source"]],
        ["RELATIONSHIP_ENDPOINT_TYPE", ["relationships", 0, "target"]],
      ]);
      expect(ds[0]!.hint).toBe("Allowed source types (or their subtypes): container.");
    });

    it("rejects a supertype where a subtype is required", () => {
      expect(codes({ "e.yaml": entities, "r.yaml": rel("reads", "api", "api") })).toEqual([
        "RELATIONSHIP_ENDPOINT_TYPE",
      ]);
    });

    it("treats unconstrained relationship types as accepting any endpoint", () => {
      expect(codes({ "e.yaml": entities, "r.yaml": rel("uses", "user", "db") })).toEqual([]);
    });
  });

  describe("secret detection (SEC-08)", () => {
    it("warns on credential-like property keys at any depth", () => {
      const ds = check({
        "p.yaml": res("Project", "id: p\nname: P\nproperties:\n  apiKey: x"),
        "e.yaml": res(
          "Entity",
          "id: a\nname: A\ntype: actor\nproperties:\n  db:\n    password: hunter2\n  list: [{token: t}]\n  tier: gold",
        ),
        "r.yaml": res(
          "RelationshipSet",
          "id: rs\nrelationships:\n  - {id: r, type: uses, source: a, target: a, properties: {client_secret: s}}",
        ),
      });
      expect(ds.map((d) => [d.code, d.severity, d.file, d.path])).toEqual([
        ["SECRET_SUSPECTED", "warning", "e.yaml", ["properties", "db", "password"]],
        ["SECRET_SUSPECTED", "warning", "e.yaml", ["properties", "list", "0", "token"]],
        ["SECRET_SUSPECTED", "warning", "p.yaml", ["properties", "apiKey"]],
        [
          "SECRET_SUSPECTED",
          "warning",
          "r.yaml",
          ["relationships", 0, "properties", "client_secret"],
        ],
      ]);
    });
  });

  describe("layout references (LAYOUT-13, LAYOUT-18)", () => {
    const base = {
      "e.yaml": res("Entity", "id: a\nname: A\ntype: actor"),
      "r.yaml": res(
        "RelationshipSet",
        "id: rs\nrelationships:\n  - {id: r, type: uses, source: a, target: a}",
      ),
      "d.yaml": res(
        "Diagram",
        "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: a}]\nedges: [{relationship: r}]",
      ),
    };

    it("accepts layouts that match the diagram", () => {
      expect(
        codes({
          ...base,
          "d.layout.yaml": res(
            "DiagramLayout",
            "diagram: d\nnodes: {a: {x: 0, y: 0}}\nedges: {r: {type: step}}",
          ),
        }),
      ).toEqual([]);
    });

    it("warns on orphaned node and edge overrides", () => {
      const ds = check({
        ...base,
        "d.layout.yaml": res(
          "DiagramLayout",
          "diagram: d\nnodes: {old: {x: 0, y: 0}}\nedges: {gone: {type: step}}",
        ),
      });
      expect(ds.map((d) => [d.code, d.severity, d.path])).toEqual([
        ["LAYOUT_ORPHAN_EDGE", "warning", ["edges", "gone"]],
        ["LAYOUT_ORPHAN_NODE", "warning", ["nodes", "old"]],
      ]);
    });

    it("warns on layouts for unknown diagrams", () => {
      expect(codes({ "x.layout.yaml": res("DiagramLayout", "diagram: ghost") })).toEqual([
        "LAYOUT_ORPHAN_DIAGRAM",
      ]);
    });
  });

  it("includes diagram resolution diagnostics", () => {
    expect(
      codes({
        "d.yaml": res("Diagram", "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: ghost}]"),
      }),
    ).toEqual(["REF_MISSING"]);
  });

  it("returns diagnostics in deterministic order", () => {
    const files = {
      "b.yaml": res("Entity", "id: b\nname: B\ntype: nope"),
      "a.yaml": res("Entity", "id: a\nname: A\ntype: nope"),
    };
    expect(check(files).map((d) => d.file)).toEqual(["a.yaml", "b.yaml"]);
  });
});
