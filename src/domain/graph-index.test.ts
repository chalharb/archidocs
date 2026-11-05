import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE_TYPES, buildModel, docs, parseFiles, res } from "../../tests/helpers/model";
import { buildGraphIndex, lookup } from "./graph-index";
import { normalize } from "./normalize";

const FILES = {
  "types.yaml": BASE_TYPES,
  "e.yaml": res(
    "EntitySet",
    `id: es
entities:
  - {id: sys, name: Sys, type: software-system}
  - {id: web, name: Web, type: container, parent: sys}
  - {id: api, name: API, type: container, parent: sys}
  - {id: db, name: DB, type: database, parent: api}
  - {id: user, name: User, type: person}
  - {id: orphan, name: O, type: actor, parent: ghost}`,
  ),
  "r.yaml": res(
    "RelationshipSet",
    `id: rs
relationships:
  - {id: u-web, type: uses, source: user, target: web}
  - {id: web-api, type: uses, source: web, target: api}
  - {id: u-api, type: uses, source: user, target: api}
  - {id: api-db, type: reads, source: api, target: db}
  - {id: dangling, type: uses, source: user, target: ghost}`,
  ),
  "d.yaml": docs(
    res(
      "Diagram",
      "id: ctx\nname: C\ndiagramType: c4-context\nnodes: [{entity: user}, {entity: sys}]",
    ),
    res(
      "Diagram",
      "id: cnt\nname: C\ndiagramType: c4-container\nnodes: [{entity: user}, {entity: web}, {id: api-1, entity: api}, {id: api-2, entity: api}, {entity: ghost}]\nedges: [{relationship: u-web}, {relationship: nope}]",
    ),
  ),
};

describe("TEST-04 graph indexing", () => {
  const { model } = buildModel(FILES);
  const index = buildGraphIndex(model);

  it("indexes incoming and outgoing relationships", () => {
    expect(lookup.outgoing(index, "user")).toEqual(["dangling", "u-api", "u-web"]);
    expect(lookup.incoming(index, "api")).toEqual(["u-api", "web-api"]);
    expect(lookup.incoming(index, "ghost")).toEqual([]);
    expect(lookup.outgoing(index, "db")).toEqual([]);
  });

  it("indexes parent/child lookups, ignoring missing parents", () => {
    expect(lookup.children(index, "sys")).toEqual(["api", "web"]);
    expect(lookup.parent(index, "db")).toBe("api");
    expect(lookup.parent(index, "orphan")).toBeUndefined();
    expect(lookup.children(index, "ghost")).toEqual([]);
    expect(lookup.ancestors(index, "db")).toEqual(["api", "sys"]);
    expect(lookup.descendants(index, "sys")).toEqual(["api", "web", "db"]);
  });

  it("indexes entity-to-diagram and relationship-to-diagram references", () => {
    expect(lookup.diagramsForEntity(index, "user")).toEqual(["cnt", "ctx"]);
    expect(lookup.diagramsForEntity(index, "api")).toEqual(["cnt"]);
    expect(lookup.diagramsForEntity(index, "ghost")).toEqual([]);
    expect(lookup.diagramsForRelationship(index, "u-web")).toEqual(["cnt"]);
    expect(lookup.diagramsForRelationship(index, "nope")).toEqual([]);
    expect(index.entitiesByType.container).toEqual(["api", "web"]);
  });

  it("is safe on cyclic hierarchies", () => {
    const { model: cyclic } = buildModel({
      "types.yaml": BASE_TYPES,
      "e.yaml": docs(
        res("Entity", "id: a\nname: A\ntype: actor\nparent: b"),
        res("Entity", "id: b\nname: B\ntype: actor\nparent: a"),
        res("Entity", "id: s\nname: S\ntype: actor\nparent: s"),
      ),
    });
    const i = buildGraphIndex(cyclic);
    expect(lookup.ancestors(i, "a")).toEqual(["b"]);
    expect(lookup.descendants(i, "a")).toEqual(["b"]);
    expect(lookup.parent(i, "s")).toBeUndefined();
  });

  it("rebuilds deterministically regardless of file order", () => {
    const parsed = parseFiles(FILES);
    const expected = JSON.stringify(buildGraphIndex(normalize(parsed).model));
    fc.assert(
      fc.property(
        fc.shuffledSubarray(parsed, { minLength: parsed.length, maxLength: parsed.length }),
        (shuffled) => {
          expect(JSON.stringify(buildGraphIndex(normalize(shuffled).model))).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("reflects model changes on rebuild", () => {
    const changed = structuredClone(model);
    delete changed.relationships["u-api"];
    const rebuilt = buildGraphIndex(changed);
    expect(lookup.outgoing(rebuilt, "user")).toEqual(["dangling", "u-web"]);
    expect(lookup.outgoing(index, "user")).toEqual(["dangling", "u-api", "u-web"]);
  });
});
