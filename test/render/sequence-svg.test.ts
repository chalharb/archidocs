import { beforeAll, describe, expect, it } from "vitest";
import { dynamicView } from "../support/views.ts";
import { renderSequenceSvg, type RenderSource } from "../../src/render/index.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { checkoutScenarioWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const source: RenderSource = { workspace: "acme-architecture", commit: "0123456789abcdef0123456789abcdef01234567", date: "2026-11-22T10:30:00+01:00" };
let bundle: Bundle;

beforeAll(async () => {
  ({ bundle } = await loadWorkspace(checkoutScenarioWorkspace));
});

const render = (id: string, brokers = false) => renderSequenceSvg({ bundle, view: dynamicView(bundle, id)!, source, brokers });

/** The text a reader sees, one string per `<text>` element, entities decoded. */
const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1]!.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
/** The Step arrows, by their data-step key. */
const arrows = (svg: string) => [...svg.matchAll(/<path data-step="([^"]+)"([^>]*)\/>/g)].map((m) => ({ key: m[1]!, attrs: m[2]! }));

describe("renderSequenceSvg", () => {
  it("draws the 46-Step full checkout exactly as its golden file, the same bytes every time", async () => {
    const svg = render("shop:full-checkout");

    await expect(svg).toMatchFileSnapshot("golden/sequence-full-checkout.svg");
    expect(render("shop:full-checkout")).toBe(svg);
  });

  it("titles the chart and gives its source line", () => {
    expect(texts(render("shop:pay")).slice(0, 2)).toEqual(["Pay for an order", "acme-architecture · 0123456 · 2026-11-22"]);
  });

  it("names each participant in its header and numbers every Step", () => {
    const seen = texts(render("shop:pay"));

    for (const name of ["Checkout API", "Payments API", "Fraud Scorer"]) expect(seen).toContain(name);
    for (const n of ["1", "2", "3", "4"]) expect(seen).toContain(n);
  });

  it("draws sync calls solid with a filled head, async solid with an open head and returns dashed with an open head", () => {
    const byKey = new Map(arrows(render("shop:full-checkout")).map((a) => [a.key, a.attrs]));

    expect(byKey.get("2")).toContain('marker-end="url(#head-filled)"');
    expect(byKey.get("2")).not.toContain("stroke-dasharray");
    expect(byKey.get("46")).toContain('marker-end="url(#head-open)"');
    expect(byKey.get("46")).not.toContain("stroke-dasharray");
    expect(byKey.get("4")).toContain('marker-end="url(#head-open)"');
    expect(byKey.get("4")).toContain("stroke-dasharray");
  });

  it("labels an event Step with its broker and channel, or with brokers shown draws its two legs", () => {
    expect(texts(render("shop:full-checkout"))).toContain("via Event Bus · payment-events");
    const legs = arrows(render("shop:full-checkout", true)).map((a) => a.key);
    expect(legs).toEqual(expect.arrayContaining(["37a", "37b", "42a", "42b"]));
    expect(texts(render("shop:full-checkout", true))).toContain("Event Bus");
  });

  it("has a key for the three arrow styles", () => {
    expect(texts(render("shop:pay"))).toEqual(expect.arrayContaining(["Sync call", "Async", "Return"]));
  });
});
