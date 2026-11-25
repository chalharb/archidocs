import { describe, expect, it } from "vitest";
import { describeLens } from "../../src/core/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const load = async () => (await loadWorkspace(landscapeWorkspace)).bundle;

describe("a Lens in words", () => {
  it.each([
    ["upstream", "Impact of Cart, upstream"],
    ["downstream", "Impact of Cart, downstream"],
    ["both", "Impact of Cart, both ways"],
  ] as const)("names an impact Lens's origin and its %s direction", async (direction, words) => {
    expect(describeLens(await load(), { impact: "shop:cart", direction })).toBe(words);
  });

  it("names a Team Lens's Team", async () => {
    expect(describeLens(await load(), { team: "payments-team" })).toBe("Team Payments");
  });

  it("names a path Lens's ends, its default shortest mode unsaid", async () => {
    expect(describeLens(await load(), { path: { from: "shop:web", to: "payments:payments-api", paths: "shortest" } })).toBe("Paths from Web to Payments API");
    expect(describeLens(await load(), { path: { from: "shop:web", to: "payments:payments-api" } })).toBe("Paths from Web to Payments API");
  });

  it("says a path Lens's other mode", async () => {
    expect(describeLens(await load(), { path: { from: "shop:web", to: "payments:payments-api", paths: 4 } })).toBe("Paths from Web to Payments API, all up to 4 hops");
  });

  it("falls back to the id of an Element or Team the Bundle doesn't know", async () => {
    const bundle = await load();
    expect(describeLens(bundle, { impact: "shop:gone", direction: "upstream" })).toBe("Impact of shop:gone, upstream");
    expect(describeLens(bundle, { team: "nobody" })).toBe("Team nobody");
    expect(describeLens(bundle, { path: { from: "shop:gone", to: "shop:cart" } })).toBe("Paths from shop:gone to Cart");
  });
});
