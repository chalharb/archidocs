import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { res } from "../../tests/helpers/model";
import {
  DEFAULT_PARSE_LIMITS,
  byteLength,
  isResourceKind,
  knownKeysAt,
  parseResources,
  parseYamlDocuments,
  validateResource,
} from "./parse";
import { entitySchema, workspaceSchema } from "./schema/resource-schemas";

const codes = (content: string, limits = DEFAULT_PARSE_LIMITS) =>
  parseResources(content, "f.yaml", limits).diagnostics.map((d) => d.code);

describe("TEST-01 parsing: valid and invalid YAML", () => {
  it("parses a valid single-document resource", () => {
    const { resources, diagnostics } = parseResources(
      res("Entity", "id: api\nname: API\ntype: container"),
      "dir/api.yaml",
    );
    expect(diagnostics).toEqual([]);
    expect(resources).toEqual([
      {
        resource: {
          apiVersion: "archdocs/v1",
          kind: "Entity",
          id: "api",
          name: "API",
          type: "container",
        },
        source: { file: "dir/api.yaml", document: 0, path: [] },
      },
    ]);
  });

  it("parses multi-document files and skips empty documents", () => {
    const content = `---\n${res("EntityType", "id: a\nname: A")}---\n---\n${res("EntityType", "id: b\nname: B")}`;
    const { resources, diagnostics } = parseResources(content, "types.yaml");
    expect(diagnostics).toEqual([]);
    expect(resources.map((r) => [r.source.document, (r.resource as { id: string }).id])).toEqual([
      [0, "a"],
      [2, "b"],
    ]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseResources("", "e.yaml")).toEqual({ resources: [], diagnostics: [] });
    expect(parseResources("# just a comment\n", "e.yaml")).toEqual({
      resources: [],
      diagnostics: [],
    });
  });

  it("reports syntax errors with line and column", () => {
    const [d] = parseResources("a: [1, 2\n", "bad.yaml").diagnostics;
    expect(d).toMatchObject({ code: "YAML_SYNTAX", file: "bad.yaml", document: 0, line: 2 });
    expect(d!.message).not.toMatch(/at line/);
  });

  it("rejects duplicate mapping keys", () => {
    expect(codes("a: 1\na: 2\n")).toEqual(["YAML_SYNTAX"]);
  });

  it("rejects non-mapping documents", () => {
    expect(codes("- 1\n- 2\n")).toEqual(["YAML_NOT_A_MAPPING"]);
    expect(codes("just a string\n")).toEqual(["YAML_NOT_A_MAPPING"]);
  });

  it("keeps valid documents when a sibling document is invalid", () => {
    const content = `${res("EntityType", "id: a\nname: A")}---\nkind: [\n`;
    const { resources, diagnostics } = parseResources(content, "m.yaml");
    expect(resources).toHaveLength(1);
    expect(diagnostics.map((d) => d.code)).toEqual(["YAML_SYNTAX"]);
  });

  it.each(["?", "? \n:", ":", "- ?", "{?}", "[?]"])("does not crash on bare keys: %j", (input) => {
    expect(() => parseResources(input, "f.yaml")).not.toThrow();
  });

  it("never throws on YAML-shaped noise (FAIL-01)", () => {
    const yamlChars = fc.constantFrom(..."ab1:-?![]{},&*#|>'\"\n \t%@`.=~");
    fc.assert(
      fc.property(fc.string({ unit: yamlChars, maxLength: 60 }), (input) => {
        expect(Array.isArray(parseResources(input, "fuzz.yaml").diagnostics)).toBe(true);
      }),
      { numRuns: 3000 },
    );
  });

  it("never throws on arbitrary input (FAIL-01)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (input) => {
        const result = parseResources(input, "fuzz.yaml");
        expect(Array.isArray(result.diagnostics)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe("TEST-01 parsing: missing required fields and versions (SCHEMA-07)", () => {
  it("reports a missing apiVersion", () => {
    expect(codes("kind: Entity\nid: a\n")).toEqual(["SCHEMA_MISSING_VERSION"]);
  });

  it.each(["archdocs/v2", "archdocs/v0", "archdocs/v1beta1", "other/v1", 1])(
    "reports unsupported version %s explicitly",
    (version) => {
      const [d] = parseResources(`apiVersion: ${version}\nkind: Entity\n`, "f.yaml").diagnostics;
      expect(d).toMatchObject({
        code: "SCHEMA_UNSUPPORTED_VERSION",
        path: ["apiVersion"],
        line: 1,
      });
      expect(d!.hint).toContain("archdocs/v1");
    },
  );

  it("reports a missing or unknown kind with a suggestion", () => {
    expect(parseResources("apiVersion: archdocs/v1\n", "f.yaml").diagnostics[0]).toMatchObject({
      code: "SCHEMA_UNKNOWN_KIND",
      message: "Missing required field 'kind'",
    });
    expect(
      parseResources("apiVersion: archdocs/v1\nkind: Entiti\n", "f.yaml").diagnostics[0],
    ).toMatchObject({
      code: "SCHEMA_UNKNOWN_KIND",
      hint: "Did you mean 'Entity'?",
    });
    expect(
      parseResources("apiVersion: archdocs/v1\nkind: Zzzzzzzz\n", "f.yaml").diagnostics[0]!.hint,
    ).toMatch(/^Valid kinds:/);
    expect(
      parseResources("apiVersion: archdocs/v1\nkind: 3\n", "f.yaml").diagnostics[0]!.hint,
    ).toMatch(/^Valid kinds:/);
  });

  it("reports each missing required field", () => {
    const { diagnostics } = parseResources(res("Entity", "id: a"), "f.yaml");
    expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
      ["SCHEMA_REQUIRED_FIELD", ["name"]],
      ["SCHEMA_REQUIRED_FIELD", ["type"]],
    ]);
    expect(diagnostics[0]!.hint).toBe("Add 'name' (expected string).");
  });

  it("reports missing fields of nested items with their path", () => {
    const { diagnostics } = parseResources(
      res("EntitySet", "id: s\nentities:\n  - id: a\n    name: A"),
      "f.yaml",
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "SCHEMA_REQUIRED_FIELD",
      path: ["entities", 0, "type"],
    });
  });
});

describe("TEST-01 parsing: unknown fields (SCHEMA-08)", () => {
  it("reports unknown top-level fields with a did-you-mean hint and location", () => {
    const { diagnostics } = parseResources(
      res("Entity", "id: a\nname: A\ntype: t\nnmae: x"),
      "f.yaml",
    );
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "SCHEMA_UNKNOWN_FIELD",
        path: ["nmae"],
        line: 6,
        hint: "Did you mean 'name'?",
      }),
    ]);
  });

  it("lists allowed fields when nothing is close", () => {
    const [d] = parseResources(
      res("Entity", "id: a\nname: A\ntype: t\nzzzzzzzzzz: 1"),
      "f.yaml",
    ).diagnostics;
    expect(d!.hint).toMatch(/^Allowed fields: .*Put custom metadata under 'properties'/);
  });

  it("reports unknown fields in nested objects", () => {
    const [d] = parseResources(
      res("Diagram", "id: d\nname: D\ndiagramType: network\nnodes:\n  - entity: a\n    lable: x"),
      "f.yaml",
    ).diagnostics;
    expect(d).toMatchObject({ path: ["nodes", 0, "lable"], hint: "Did you mean 'label'?" });
  });

  it("reports unknown fields inside record values", () => {
    const [d] = parseResources(
      res("DiagramLayout", "diagram: d\nnodes:\n  a: {x: 1, y: 2, z: 3}"),
      "f.yaml",
    ).diagnostics;
    expect(d).toMatchObject({ code: "SCHEMA_UNKNOWN_FIELD", path: ["nodes", "a", "z"] });
  });

  it("permits arbitrary keys under properties (MODEL-05)", () => {
    const { resources, diagnostics } = parseResources(
      res(
        "Entity",
        "id: a\nname: A\ntype: t\nproperties:\n  tier: gold\n  sla: {uptime: 99.9, regions: [eu, us]}\n  pager: null",
      ),
      "f.yaml",
    );
    expect(diagnostics).toEqual([]);
    expect(resources[0]!.resource).toMatchObject({
      properties: { tier: "gold", sla: { uptime: 99.9, regions: ["eu", "us"] }, pager: null },
    });
  });

  it("finds known keys through optional, array, record and lazy wrappers", () => {
    expect(knownKeysAt(entitySchema, [])).toContain("name");
    expect(knownKeysAt(workspaceSchema, ["defaults"])).toEqual(["layout"]);
    expect(knownKeysAt(workspaceSchema, ["defaults", "layout"])).toContain("direction");
    expect(knownKeysAt(entitySchema, ["nope"])).toEqual([]);
    expect(knownKeysAt(entitySchema, ["name", "x"])).toEqual([]);
    expect(knownKeysAt(entitySchema, ["properties", "k"])).toEqual([]);
    expect(knownKeysAt(entitySchema, ["tags"])).toEqual([]);
  });
});

describe("TEST-01 parsing: unsupported YAML types and safety (SEC-05, SEC-06)", () => {
  it.each([
    ["binary", "a: !!binary aGVsbG8=\n"],
    ["set", "a: !!set {x}\n"],
    ["omap", "a: !!omap [x: 1]\n"],
    ["timestamp", "a: !!timestamp 2020-01-01\n"],
    ["custom tag", "a: !js/function 'function(){}'\n"],
    ["python tag", "a: !!python/object:os.system ls\n"],
    ["local tag on map", "a: !thing {b: 1}\n"],
  ])("rejects %s", (_name, content) => {
    expect(codes(content)).toEqual(["YAML_UNSAFE_TAG"]);
  });

  it("allows explicit core tags", () => {
    const { diagnostics } = parseResources(
      res("EntityType", "id: !!str a\nname: !!str A"),
      "f.yaml",
    );
    expect(diagnostics).toEqual([]);
  });

  it("does not interpret dates (core schema keeps them as strings)", () => {
    const { resources } = parseResources(
      res("Entity", "id: a\nname: A\ntype: t\nproperties:\n  since: 2020-01-01"),
      "f.yaml",
    );
    expect(resources[0]!.resource).toMatchObject({ properties: { since: "2020-01-01" } });
  });

  it.each(["__proto__", "constructor", "prototype"])("rejects reserved key %s", (key) => {
    const content = res(
      "Entity",
      `id: a\nname: A\ntype: t\nproperties:\n  ${key}: {polluted: true}`,
    );
    const { diagnostics, resources } = parseResources(content, "f.yaml");
    expect(resources).toEqual([]);
    expect(diagnostics[0]).toMatchObject({ code: "SCHEMA_INVALID_VALUE", line: 7 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("enforces the file size limit", () => {
    const limits = { ...DEFAULT_PARSE_LIMITS, maxBytes: 10 };
    expect(codes("a: 12345678901\n", limits)).toEqual(["YAML_TOO_LARGE"]);
    // 8 bytes: under the limit, so it parses and fails later on the missing apiVersion
    expect(codes("a: 1234\n", limits)).toEqual(["SCHEMA_MISSING_VERSION"]);
  });

  it("measures size in bytes, not characters", () => {
    expect(byteLength("é")).toBe(2);
    const limits = { ...DEFAULT_PARSE_LIMITS, maxBytes: 9 };
    expect(codes("a: éééé\n", limits)).toEqual(["YAML_TOO_LARGE"]);
  });

  it("enforces the document count limit", () => {
    const limits = { ...DEFAULT_PARSE_LIMITS, maxDocuments: 2 };
    expect(codes("a: 1\n---\nb: 1\n---\nc: 1\n", limits)).toEqual(["YAML_TOO_LARGE"]);
  });

  it("enforces the nesting depth limit at the boundary", () => {
    const nested = (depth: number) =>
      "a: ".repeat(1) + "[".repeat(depth - 1) + "]".repeat(depth - 1) + "\n";
    const limits = { ...DEFAULT_PARSE_LIMITS, maxDepth: 5 };
    // depth 5 = root map + 4 nested sequences: allowed (fails later on schema only)
    expect(codes(nested(5), limits)).not.toContain("YAML_TOO_DEEP");
    expect(codes(nested(6), limits)).toEqual(["YAML_TOO_DEEP"]);
  });

  it("limits alias expansion (billion laughs)", () => {
    const lol = [
      "a: &a [x, x, x, x, x, x, x, x, x]",
      "b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]",
      "c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]",
      "d: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]",
      "e: [*d, *d, *d, *d, *d, *d, *d, *d, *d]",
    ].join("\n");
    expect(codes(lol)).toEqual(["YAML_ALIAS_LIMIT"]);
  });

  it("allows modest alias use", () => {
    const content = res("Entity", "id: a\nname: &n A\ntype: t\ndescription: *n");
    const { resources, diagnostics } = parseResources(content, "f.yaml");
    expect(diagnostics).toEqual([]);
    expect(resources[0]!.resource).toMatchObject({ description: "A" });
  });
});

describe("parse helpers", () => {
  it("parseYamlDocuments exposes raw values and locations", () => {
    const { documents } = parseYamlDocuments("a:\n  b: 1\n", "f.yaml");
    expect(documents[0]!.value).toEqual({ a: { b: 1 } });
    expect(documents[0]!.locate(["a", "b"])).toEqual({ line: 2, column: 6 });
    expect(documents[0]!.locate(["a", "missing"])).toEqual({ line: 2, column: 3 });
    expect(documents[0]!.locate(["a", "b", "deeper"])).toEqual({ line: 2, column: 6 });
  });

  it("isResourceKind", () => {
    expect(isResourceKind("Entity")).toBe(true);
    expect(isResourceKind("entity")).toBe(false);
    expect(isResourceKind(1)).toBe(false);
  });

  it("validateResource works without a locator", () => {
    expect(validateResource(null, { file: "f", document: 0 }).diagnostics[0]!.code).toBe(
      "YAML_NOT_A_MAPPING",
    );
    expect(
      validateResource(
        { apiVersion: "archdocs/v1", kind: "EntityType", id: "t", name: "T" },
        { file: "f", document: 0 },
      ).resource,
    ).toEqual({ apiVersion: "archdocs/v1", kind: "EntityType", id: "t", name: "T" });
  });
});
