import { describe, expect, it } from "vitest";
import { compareView, type ResolvedView } from "../../src/core/index.ts";
import { historyAfter, historyBefore } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

async function sides() {
  const [before, after] = await Promise.all([loadWorkspace(historyBefore), loadWorkspace(historyAfter)]);
  return { before: before.bundle, after: after.bundle };
}

const nodeMarks = (view: ResolvedView) => Object.fromEntries(view.nodes.map((n) => [n.id, n.change]));
const edgeMarks = (view: ResolvedView) => Object.fromEntries(view.edges.map((e) => [`${e.from} -> ${e.to}`, e.change]));

describe("compareView", () => {
  it("lays a View over the union of both sides, marking what was added, removed and changed", async () => {
    const { before, after } = await sides();

    const view = compareView(before, after, "c2", { collapse: ["payments:payments", "shop:checkout", "shop:legacy"] })!;

    expect(nodeMarks(view)).toEqual({
      "payments:payments": "unchanged",
      "shop:checkout": "unchanged",
      "shop:events": "unchanged",
      "shop:legacy": "removed",
      "shop:shopper": "unchanged",
      "shop:web": "changed",
      "shop:wishlist": "added",
    });
    expect(edgeMarks(view)).toMatchObject({
      "shop:legacy -> payments:payments": "removed",
      "shop:wishlist -> shop:checkout": "added",
      "shop:web -> shop:checkout": "unchanged",
    });
  });

  it("marks a collapsed box changed when something inside it changed, and opens boxes from either side", async () => {
    const { before, after } = await sides();
    const renamedCart = { ...after, elements: after.elements.map((e) => (e.id === "shop:cart" ? { ...e, name: "Basket" } : e)) };

    const collapsed = compareView(before, renamedCart, "c2", { collapse: ["shop:checkout"] })!;
    const opened = compareView(before, renamedCart, "c2")!;

    expect(nodeMarks(collapsed)["shop:checkout"]).toBe("changed");
    expect(nodeMarks(opened)).toMatchObject({ "shop:checkout": "unchanged", "shop:cart": "changed", "shop:legacy": "removed", "shop:old-cart": "removed" });
  });

  it("opens a View that exists on one side only, drawn from that side with everything in it marked", async () => {
    const { before, after } = await sides();

    const removed = compareView(before, after, "c2/shop:legacy")!;
    const added = compareView(after, before, "c2/shop:legacy")!;

    expect(nodeMarks(removed)).toEqual({ "shop:legacy": "removed", "shop:old-cart": "removed", "payments:payments": "removed" });
    expect(edgeMarks(removed)).toEqual({ "shop:old-cart -> payments:payments": "removed" });
    expect(nodeMarks(added)).toEqual({ "shop:legacy": "added", "shop:old-cart": "added", "payments:payments": "added" });
    expect(compareView(before, after, "c2/shop:nowhere")).toBeUndefined();
  });
});
