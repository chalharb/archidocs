import { describe, expect, it } from "vitest";
import { structuralView } from "../support/views.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const load = async () => {
  const { bundle, issues } = await loadWorkspace({
    ...landscapeWorkspace,
    "shop/views.yaml": `views:\n  structural:\n    mine:\n      title: Mine\n      level: c2\n      lens: { team: payments-team }\n`,
  });
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  return bundle;
};

const hit = (view: ReturnType<typeof structuralView>) => view!.nodes.filter((n) => n.mark?.hit).map((n) => n.id);

describe("the Lens a View is resolved with", () => {
  it("is a Saved View's own by default", async () => {
    const view = structuralView(await load(), "shop:mine");
    expect(view?.lens).toEqual({ team: "payments-team" });
    expect(hit(view)).toEqual(["payments:payments", "payments:payments-api", "shop:fraud-check"]);
  });

  it("is none when asked for none, clearing a Saved View's own", async () => {
    const view = structuralView(await load(), "shop:mine", { lens: "none" })!;
    expect(view.lens).toBeUndefined();
    expect(view.nodes.some((n) => n.mark !== undefined)).toBe(false);
    expect(view.edges.some((e) => e.lit !== undefined)).toBe(false);
  });

  it("is the given Lens, replacing a Saved View's own", async () => {
    const view = structuralView(await load(), "shop:mine", { lens: { impact: "shop:cart", direction: "upstream" } });
    expect(view?.lens).toEqual({ impact: "shop:cart", direction: "upstream" });
    expect(hit(view)).toEqual(["shop:cart", "shop:shopper", "shop:web"]);
  });

  it("is none by default on a Generated View, which has no Lens of its own", async () => {
    const view = structuralView(await load(), "c2", { lens: "own" })!;
    expect(view.lens).toBeUndefined();
    expect(view.nodes.some((n) => n.mark !== undefined)).toBe(false);
  });
});
