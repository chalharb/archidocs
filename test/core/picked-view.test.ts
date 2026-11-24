import { describe, expect, it } from "vitest";
import { pickedView } from "../../src/core/index.ts";
import { structuralView } from "../support/views.ts";
import { loadWorkspace } from "../support/workspace.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";

describe("Picked nodes of a View", () => {
  it("keeps the picks with their open containers and the edges among them, Lens marks and all", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);
    const view = structuralView(bundle, "c2", { expand: ["shop:checkout"], lens: { impact: "shop:cart", direction: "upstream" } })!;
    const picked = pickedView(view, ["shop:cart", "shop:web", "shop:shopper"]);
    expect(picked.nodes.map((n) => [n.id, n.parent, n.mark?.hit])).toEqual([
      ["shop:cart", "shop:checkout", true],
      ["shop:checkout", null, false],
      ["shop:shopper", null, true],
      ["shop:web", null, true],
    ]);
    expect(picked.edges.map((e) => [e.from, e.to, e.lit])).toEqual([
      ["shop:shopper", "shop:web", true],
      ["shop:web", "shop:cart", true],
    ]);
    expect(picked.lens).toEqual(view.lens);
    expect(picked.title).toBe("C2 Landscape");
  });
});

describe("A Saved View's own Lens", () => {
  it("is cleared by resolving with lens: null", async () => {
    const { bundle } = await loadWorkspace({
      ...landscapeWorkspace,
      "shop/views.yaml": `views:\n  structural:\n    mine:\n      title: Mine\n      level: c2\n      lens: { team: payments-team }\n`,
    });
    expect(structuralView(bundle, "shop:mine")?.lens).toEqual({ team: "payments-team" });
    const cleared = structuralView(bundle, "shop:mine", { lens: null })!;
    expect(cleared.lens).toBeUndefined();
    expect(cleared.nodes.some((n) => n.mark !== undefined)).toBe(false);
    expect(cleared.edges.some((e) => e.lit !== undefined)).toBe(false);
  });
});
