import { describe, expect, it } from "vitest";
import { RESOURCE_KINDS } from "../resources";
import {
  COORDINATE_LIMIT,
  DESCRIPTION_MAX_LENGTH,
  ID_MAX_LENGTH,
  MAX_TAGS,
  NAME_MAX_LENGTH,
  RESOURCE_SCHEMAS,
  decisionSchema,
  diagramLayoutSchema,
  diagramSchema,
  documentSchema,
  entitySchema,
  idSchema,
  layoutSettingsSchema,
  relationshipTypeSchema,
  workspaceSchema,
} from "./resource-schemas";

const H = { apiVersion: "archdocs/v1" } as const;

/** One minimal valid example per kind (KIND-*). */
const VALID: Record<(typeof RESOURCE_KINDS)[number], unknown> = {
  Workspace: {
    ...H,
    kind: "Workspace",
    id: "ws",
    name: "WS",
    defaults: { layout: { direction: "LEFT" } },
  },
  Project: {
    ...H,
    kind: "Project",
    id: "p",
    name: "P",
    owner: "team",
    tags: ["a"],
    properties: { k: 1 },
  },
  Entity: { ...H, kind: "Entity", id: "e", name: "E", type: "t" },
  EntitySet: { ...H, kind: "EntitySet", id: "s", entities: [{ id: "e", name: "E", type: "t" }] },
  EntityType: { ...H, kind: "EntityType", id: "t", name: "T", extends: "base" },
  RelationshipSet: {
    ...H,
    kind: "RelationshipSet",
    id: "rs",
    relationships: [{ id: "r", type: "uses", source: "a", target: "b" }],
  },
  RelationshipType: {
    ...H,
    kind: "RelationshipType",
    id: "uses",
    name: "Uses",
    sources: ["t"],
    targets: ["t"],
  },
  Diagram: {
    ...H,
    kind: "Diagram",
    id: "d",
    name: "D",
    diagramType: "c4-context",
    nodes: [{ entity: "e" }, { id: "e2", entity: "e", label: "Copy" }],
    edges: [{ relationship: "r", source: "e", target: "e2" }],
  },
  DiagramLayout: {
    ...H,
    kind: "DiagramLayout",
    diagram: "d",
    settings: { edgeType: "step" },
    nodes: { e: { x: 0, y: -10.5, width: 100, height: 50 } },
    edges: { r: { type: "bezier" } },
  },
  Document: {
    ...H,
    kind: "Document",
    id: "overview",
    title: "Overview",
    entities: ["e"],
    diagrams: ["d"],
    tags: ["intro"],
  },
  Decision: {
    ...H,
    kind: "Decision",
    id: "adr-0002",
    title: "Use PostgreSQL",
    status: "accepted",
    date: "2026-03-14",
    deciders: ["Payments team"],
    supersedes: ["adr-0001"],
  },
};

describe("SCHEMA-01: strict schema per resource kind", () => {
  it("has a schema for every kind", () => {
    expect(Object.keys(RESOURCE_SCHEMAS).sort()).toEqual([...RESOURCE_KINDS].sort());
  });

  it.each(RESOURCE_KINDS)("accepts a valid %s", (kind) => {
    expect(RESOURCE_SCHEMAS[kind].safeParse(VALID[kind]).success).toBe(true);
  });

  it.each(RESOURCE_KINDS)("rejects unknown fields on %s", (kind) => {
    const result = RESOURCE_SCHEMAS[kind].safeParse({ ...(VALID[kind] as object), surprise: 1 });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.code).toBe("unrecognized_keys");
  });

  it.each(RESOURCE_KINDS)("rejects the wrong kind literal on %s", (kind) => {
    expect(
      RESOURCE_SCHEMAS[kind].safeParse({ ...(VALID[kind] as object), kind: "Nope" }).success,
    ).toBe(false);
  });
});

describe("TEST-01: schema boundary values", () => {
  it("IDs: length and character boundaries", () => {
    expect(idSchema.safeParse("a").success).toBe(true);
    expect(idSchema.safeParse("a".repeat(ID_MAX_LENGTH)).success).toBe(true);
    expect(idSchema.safeParse("a".repeat(ID_MAX_LENGTH + 1)).success).toBe(false);
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("A1._-z").success).toBe(true);
    for (const bad of ["-a", ".a", "_a", "a b", "a/b", "../x", "a:b", "é"]) {
      expect(idSchema.safeParse(bad).success, bad).toBe(false);
    }
    expect(idSchema.safeParse(1).success).toBe(false);
  });

  it("names: trimmed, non-empty, bounded", () => {
    const e = (name: unknown) => entitySchema.safeParse({ ...(VALID.Entity as object), name });
    expect(e("x".repeat(NAME_MAX_LENGTH)).success).toBe(true);
    expect(e("x".repeat(NAME_MAX_LENGTH + 1)).success).toBe(false);
    expect(e("   ").success).toBe(false);
    expect(e(" A ").data?.name).toBe("A");
  });

  it("descriptions and tags are bounded", () => {
    const e = (extra: object) => entitySchema.safeParse({ ...(VALID.Entity as object), ...extra });
    expect(e({ description: "x".repeat(DESCRIPTION_MAX_LENGTH) }).success).toBe(true);
    expect(e({ description: "x".repeat(DESCRIPTION_MAX_LENGTH + 1) }).success).toBe(false);
    expect(e({ tags: Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`) }).success).toBe(true);
    expect(e({ tags: Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`) }).success).toBe(
      false,
    );
    expect(e({ tags: [""] }).success).toBe(false);
  });

  it("layout settings: numeric ranges and enums", () => {
    const base = {
      direction: "DOWN",
      nodeSpacing: 0,
      layerSpacing: 1000,
      edgeType: "smoothstep",
      gridSize: 1,
      snapToGrid: true,
      nodeWidth: 10,
      nodeHeight: 2000,
      animateEdges: false,
      showMinimap: true,
    };
    expect(layoutSettingsSchema.safeParse(base).success).toBe(true);
    for (const [k, v] of [
      ["nodeSpacing", -1],
      ["layerSpacing", 1001],
      ["gridSize", 0],
      ["gridSize", 1.5],
      ["gridSize", 201],
      ["nodeWidth", 9],
      ["direction", "down"],
      ["edgeType", "curvy"],
      ["snapToGrid", "yes"],
      ["animateEdges", "no"],
      ["showMinimap", "no"],
      ["nodeSpacing", Infinity],
      ["nodeSpacing", NaN],
    ] as const) {
      expect(layoutSettingsSchema.safeParse({ ...base, [k]: v }).success, `${k}=${v}`).toBe(false);
    }
  });

  it("layout coordinates are finite and bounded", () => {
    const layout = (x: number) =>
      diagramLayoutSchema.safeParse({
        ...H,
        kind: "DiagramLayout",
        diagram: "d",
        nodes: { a: { x, y: 0 } },
      });
    expect(layout(COORDINATE_LIMIT).success).toBe(true);
    expect(layout(-COORDINATE_LIMIT).success).toBe(true);
    expect(layout(COORDINATE_LIMIT + 1).success).toBe(false);
    expect(layout(Infinity).success).toBe(false);
    expect(
      diagramLayoutSchema.safeParse({
        ...H,
        kind: "DiagramLayout",
        diagram: "d",
        nodes: { a: { x: 0, y: 0, width: 0 } },
      }).success,
    ).toBe(false);
    expect(
      diagramLayoutSchema.safeParse({
        ...H,
        kind: "DiagramLayout",
        diagram: "d",
        nodes: { "../a": { x: 0, y: 0 } },
      }).success,
    ).toBe(false);
  });

  it("diagram types are a closed set", () => {
    expect(
      diagramSchema.safeParse({ ...(VALID.Diagram as object), diagramType: "network" }).success,
    ).toBe(true);
    expect(
      diagramSchema.safeParse({ ...(VALID.Diagram as object), diagramType: "uml" }).success,
    ).toBe(false);
  });

  it("relationship type endpoint lists must be non-empty when present", () => {
    expect(
      relationshipTypeSchema.safeParse({ ...(VALID.RelationshipType as object), sources: [] })
        .success,
    ).toBe(false);
  });

  it("workspace defaults are strict", () => {
    expect(
      workspaceSchema.safeParse({ ...(VALID.Workspace as object), defaults: { theme: "x" } })
        .success,
    ).toBe(false);
  });
});

describe("ADR-01 / DOC-02: document and decision front matter (ADD-009)", () => {
  const doc = VALID.Document as Record<string, unknown>;
  const adr = VALID.Decision as Record<string, unknown>;

  it("requires a title on documents and validates reference lists", () => {
    const { title: _t, ...untitled } = doc;
    expect(documentSchema.safeParse(untitled).success).toBe(false);
    expect(documentSchema.safeParse({ ...doc, entities: ["not valid!"] }).success).toBe(false);
    expect(documentSchema.safeParse({ ...doc, title: " " }).success).toBe(false);
  });

  it("accepts every decision status and rejects others", () => {
    for (const status of ["proposed", "accepted", "rejected", "deprecated", "superseded"])
      expect(decisionSchema.safeParse({ ...adr, status }).success, status).toBe(true);
    expect(decisionSchema.safeParse({ ...adr, status: "Accepted" }).success).toBe(false);
  });

  it("requires real YYYY-MM-DD dates", () => {
    for (const date of ["2024-02-29", "1999-12-31"])
      expect(decisionSchema.safeParse({ ...adr, date }).success, date).toBe(true);
    for (const date of ["2023-02-29", "2026-13-01", "2026-1-5", "14/03/2026", "2026-03-14T00:00"])
      expect(decisionSchema.safeParse({ ...adr, date }).success, date).toBe(false);
    const { date: _d, ...undated } = adr;
    expect(decisionSchema.safeParse(undated).success).toBe(false);
  });

  it("limits deciders like tags", () => {
    expect(
      decisionSchema.safeParse({ ...adr, deciders: Array(MAX_TAGS + 1).fill("x") }).success,
    ).toBe(false);
    expect(decisionSchema.safeParse({ ...adr, deciders: [""] }).success).toBe(false);
  });
});
