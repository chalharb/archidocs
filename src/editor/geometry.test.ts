import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { align, borderPoint, bounds, contains, distribute, snap, snapPoint } from "./geometry";

const box = (x: number, y: number, width = 100, height = 50) => ({ x, y, width, height });

describe("LAYOUT-03 grid snapping", () => {
  it("rounds to the nearest grid line", () => {
    expect(snap(29, 20)).toBe(20);
    expect(snap(31, 20)).toBe(40);
    expect(snap(-9, 20)).toBe(0);
    expect(Object.is(snap(-9, 20), -0)).toBe(false);
    expect(snap(13.7, 0)).toBe(13.7);
    expect(snapPoint({ x: 11, y: 49 }, 10)).toEqual({ x: 10, y: 50 });
  });

  it("is idempotent and lands on the grid (property)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        fc.integer({ min: 1, max: 200 }),
        (v, g) => {
          const s = snap(v, g);
          expect(snap(s, g)).toBe(s);
          expect(Math.abs(s - v)).toBeLessThanOrEqual(g / 2 + 1e-9);
        },
      ),
    );
  });
});

describe("LAYOUT-02 align and distribute", () => {
  const boxes = { a: box(0, 0), b: box(50, 100, 200, 80), c: box(300, 40, 50, 20) };
  const ids = ["a", "b", "c"];

  it.each([
    ["left", { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, c: { x: 0, y: 40 } }],
    ["right", { a: { x: 250, y: 0 }, b: { x: 150, y: 100 }, c: { x: 300, y: 40 } }],
    ["center", { a: { x: 125, y: 0 }, b: { x: 75, y: 100 }, c: { x: 150, y: 40 } }],
    ["top", { a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, c: { x: 300, y: 0 } }],
    ["bottom", { a: { x: 0, y: 130 }, b: { x: 50, y: 100 }, c: { x: 300, y: 160 } }],
    ["middle", { a: { x: 0, y: 65 }, b: { x: 50, y: 50 }, c: { x: 300, y: 80 } }],
  ] as const)("aligns %s", (mode, expected) => {
    expect(align(boxes, ids, mode)).toEqual(expected);
  });

  it("needs at least two known boxes to align", () => {
    expect(align(boxes, ["a"], "left")).toEqual({});
    expect(align(boxes, ["a", "missing"], "left")).toEqual({});
  });

  it("distributes with equal gaps, keeping the ends fixed", () => {
    const row = { a: box(0, 0), b: box(120, 10), c: box(500, 20), d: box(150, 0, 10, 10) };
    const out = distribute(row, ["c", "a", "b"], "horizontal");
    // span 0..600, occupied 300 => gap 150
    expect(out).toEqual({ a: { x: 0, y: 0 }, b: { x: 250, y: 10 }, c: { x: 500, y: 20 } });
    const col = distribute(
      { a: box(0, 0), b: box(5, 10), c: box(0, 300) },
      ["a", "b", "c"],
      "vertical",
    );
    expect(col).toEqual({ a: { x: 0, y: 0 }, b: { x: 5, y: 150 }, c: { x: 0, y: 300 } });
  });

  it("breaks ties by ID and needs three boxes", () => {
    const tie = { b: box(0, 0), a: box(0, 0), c: box(400, 0) };
    expect(Object.keys(distribute(tie, ["b", "a", "c"], "horizontal"))).toEqual(["a", "b", "c"]);
    expect(distribute(tie, ["a", "b"], "horizontal")).toEqual({});
  });

  it("computes bounds", () => {
    expect(bounds([])).toBeNull();
    expect(bounds(Object.values(boxes))).toEqual({ x: 0, y: 0, width: 350, height: 180 });
  });
});

describe("floating edge geometry", () => {
  const a = box(0, 0, 100, 100);
  it("leaves through the side facing the other box", () => {
    expect(borderPoint(a, box(500, 0, 100, 100))).toEqual({ x: 100, y: 50, side: "right" });
    expect(borderPoint(a, box(-500, 0, 100, 100))).toEqual({ x: 0, y: 50, side: "left" });
    expect(borderPoint(a, box(0, 500, 100, 100))).toEqual({ x: 50, y: 100, side: "bottom" });
    expect(borderPoint(a, box(0, -500, 100, 100))).toEqual({ x: 50, y: 0, side: "top" });
    const diag = borderPoint(a, box(200, 100, 100, 100));
    expect(diag.side).toBe("right");
    expect(diag.x).toBe(100);
    expect(diag.y).toBe(75);
  });
  it("handles coincident centres", () => {
    expect(borderPoint(a, a)).toEqual({ x: 50, y: 100, side: "bottom" });
  });
  it("contains", () => {
    expect(contains(a, box(10, 10, 10, 10))).toBe(true);
    expect(contains(a, box(95, 10, 10, 10))).toBe(false);
  });
});
