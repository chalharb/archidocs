import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, canRedo, canUndo, createHistory, push, redo, undo } from "./history";

describe("LAYOUT-09 undo/redo", () => {
  it("undoes and redoes in order, and a new push clears the redo stack", () => {
    let h = createHistory(0);
    expect(canUndo(h)).toBe(false);
    h = push(push(h, 1), 2);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(2);
    h = undo(undo(h));
    expect(h.present).toBe(0);
    expect(undo(h)).toBe(h);
    h = push(h, 9);
    expect(canRedo(h)).toBe(false);
    expect(redo(h)).toBe(h);
  });

  it("ignores no-op pushes and caps the history", () => {
    const h = createHistory({ v: 1 });
    expect(push(h, { v: 1 }, (a, b) => a.v === b.v)).toBe(h);
    let big = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) big = push(big, i);
    expect(big.past.length).toBe(HISTORY_LIMIT);
    expect(big.past[0]).toBe(10);
  });
});
