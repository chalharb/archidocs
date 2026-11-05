import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ancestry, effectiveConstraints, findCycles, isSubtypeOf } from "./hierarchy";

describe("findCycles (SCHEMA-05)", () => {
  const graph = (edges: Record<string, string>) => (id: string) => edges[id];

  it("finds no cycles in a tree or with dangling parents", () => {
    expect(findCycles(["a", "b", "c"], graph({ b: "a", c: "b" }))).toEqual([]);
    expect(findCycles(["a"], graph({ a: "missing" }))).toEqual([]);
  });

  it("finds self-loops and longer cycles once, rotated to the smallest ID", () => {
    expect(findCycles(["a"], graph({ a: "a" }))).toEqual([["a"]]);
    expect(findCycles(["c", "b", "a", "d"], graph({ c: "a", a: "b", b: "c", d: "c" }))).toEqual([
      ["a", "b", "c"],
    ]);
  });

  it("returns multiple cycles sorted", () => {
    expect(findCycles(["z", "y", "b", "a"], graph({ z: "y", y: "z", a: "b", b: "a" }))).toEqual([
      ["a", "b"],
      ["y", "z"],
    ]);
  });

  it("is independent of input order (property)", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom("a", "b", "c", "d", "e", "f"),
          fc.constantFrom("a", "b", "c", "d", "e", "f", "x"),
        ),
        (edges) => {
          const ids = Object.keys(edges);
          const expected = findCycles(ids, graph(edges));
          expect(findCycles([...ids].reverse(), graph(edges))).toEqual(expected);
          // Every reported cycle really is a cycle.
          for (const cycle of expected) {
            cycle.forEach((id, i) => expect(edges[id]).toBe(cycle[(i + 1) % cycle.length]));
          }
        },
      ),
    );
  });
});

describe("type inheritance (SCHEMA-06)", () => {
  const types = {
    actor: {},
    person: { extends: "actor" },
    admin: { extends: "person" },
    loop: { extends: "loop" },
  };

  it("computes ancestry and stops on cycles or missing parents", () => {
    expect(ancestry(types, "admin")).toEqual(["admin", "person", "actor"]);
    expect(ancestry(types, "loop")).toEqual(["loop"]);
    expect(ancestry(types, "unknown")).toEqual(["unknown"]);
  });

  it("checks subtypes", () => {
    expect(isSubtypeOf(types, "admin", "actor")).toBe(true);
    expect(isSubtypeOf(types, "actor", "actor")).toBe(true);
    expect(isSubtypeOf(types, "actor", "admin")).toBe(false);
  });

  it("inherits endpoint constraints from the nearest ancestor that sets them", () => {
    const rels = {
      base: { sources: ["a"] },
      mid: { extends: "base", targets: ["b"] },
      leaf: { extends: "mid" },
      override: { extends: "mid", sources: ["c"] },
      orphan: { extends: "missing" },
    };
    expect(effectiveConstraints(rels, "leaf")).toEqual({ sources: ["a"], targets: ["b"] });
    expect(effectiveConstraints(rels, "override")).toEqual({ sources: ["c"], targets: ["b"] });
    expect(effectiveConstraints(rels, "orphan")).toEqual({});
  });
});
