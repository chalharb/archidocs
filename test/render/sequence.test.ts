import { beforeAll, describe, expect, it } from "vitest";
import { type ResolvedDynamicView } from "../../src/core/index.ts";
import { dynamicView } from "../support/views.ts";
import { layoutSequence, sequenceMessages, SEQUENCE, type SequenceLayout } from "../../src/render/index.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { textWidth } from "../../src/render/text.ts";
import { checkoutScenarioWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

let bundle: Bundle;
let view: ResolvedDynamicView;
const names = (id: string) => bundle.elements.find((e) => e.id === id)?.name ?? id;

beforeAll(async () => {
  const loaded = await loadWorkspace(checkoutScenarioWorkspace);
  expect(loaded.issues).toEqual([]);
  bundle = loaded.bundle;
  view = dynamicView(bundle, "shop:full-checkout")!;
});

const api = "shop:checkout-api";
const rowOf = (layout: SequenceLayout, key: string) => layout.rows.find((r) => r.key === key)!;
const columnOf = (layout: SequenceLayout, id: string) => layout.columns.find((c) => c.id === id)!;

describe("sequence layout of the 46-Step full checkout", () => {
  it("has one row per Step, numbered in order and running down the page", () => {
    const layout = layoutSequence(view, { name: names });

    expect(layout.rows.map((r) => r.key)).toEqual(Array.from({ length: 46 }, (_, i) => String(i + 1)));
    for (const [i, row] of layout.rows.entries()) if (i > 0) expect(row.y).toBeGreaterThan(layout.rows[i - 1]!.y);
    expect(layout.rows[0]!.y).toBeGreaterThan(SEQUENCE.header);
    expect(layout.height).toBeGreaterThan(layout.rows.at(-1)!.y);
  });

  it("puts one column per participant, in participant order, left to right without overlapping", () => {
    const layout = layoutSequence(view, { name: names });

    expect(layout.columns.map((c) => c.id)).toEqual(view.participants);
    expect(layout.columns).toHaveLength(16);
    for (const [j, col] of layout.columns.entries()) {
      if (j === 0) {
        expect(col.x - col.width / 2).toBeGreaterThanOrEqual(0);
        continue;
      }
      const before = layout.columns[j - 1]!;
      expect(col.x - col.width / 2 - (before.x + before.width / 2)).toBeGreaterThanOrEqual(SEQUENCE.columnGap - 0.01);
    }
    const last = layout.columns.at(-1)!;
    expect(layout.width).toBeGreaterThanOrEqual(last.x + last.width / 2);
  });

  it("makes each header wide enough for its whole name, however long", () => {
    const long = "Customer Identity and Access Management Server";
    expect(long.length).toBeGreaterThanOrEqual(40);
    const layout = layoutSequence(view, { name: (id) => (id === api ? long : names(id)) });

    expect(columnOf(layout, api).width).toBeGreaterThanOrEqual(textWidth(long, SEQUENCE.nameSize, 700) + SEQUENCE.headerPad);
    for (const col of layout.columns) expect(col.width, col.id).toBeGreaterThanOrEqual(textWidth(col.id === api ? long : names(col.id), SEQUENCE.nameSize, 700) + SEQUENCE.headerPad);
  });

  it("leaves every label room between the two lifelines it joins", () => {
    const layout = layoutSequence(view, { name: names });

    for (const row of layout.rows) {
      const [a, b] = [columnOf(layout, row.from).x, columnOf(layout, row.to).x];
      expect(Math.abs(b - a), `Step ${row.key}`).toBeGreaterThanOrEqual(row.labelWidth + SEQUENCE.labelPad - 0.01);
    }
  });

  it("places each column as far left as its lower bounds allow: one bound is tight", () => {
    const layout = layoutSequence(view, { name: names });

    for (const [j, col] of layout.columns.entries()) {
      if (j === 0) continue;
      const before = layout.columns[j - 1]!;
      const bounds = [before.x + before.width / 2 + col.width / 2 + SEQUENCE.columnGap];
      for (const row of layout.rows) {
        const ends = [layout.columns.findIndex((c) => c.id === row.from), layout.columns.findIndex((c) => c.id === row.to)];
        if (Math.max(...ends) === j) bounds.push(layout.columns[Math.min(...ends)]!.x + row.labelWidth + SEQUENCE.labelPad);
      }
      expect(Math.max(...bounds), col.id).toBeCloseTo(col.x, 5);
    }
  });

  it("opens an activation bar on a sync call and closes it at the call's return, nesting deeper calls", () => {
    const layout = layoutSequence(view, { name: names });
    const bars = (id: string) => layout.activations.filter((a) => a.participant === id).map((a) => [a.top, a.bottom, a.depth]);
    const y = (key: string) => rowOf(layout, key).y;

    expect(bars(api)).toEqual([
      [y("2"), y("17"), 0],
      [y("20"), y("35"), 0],
    ]);
    expect(bars("identity:auth")).toEqual([
      [y("3"), y("4"), 0],
      [y("21"), y("22"), 0],
    ]);
    expect(bars("shop:pricing")).toEqual([[y("7"), y("10"), 0]]);
    expect(bars("payments:payments-api")).toEqual([[y("27"), y("33"), 0]]);
  });

  it("gives async calls and event Steps no activation bar", () => {
    const layout = layoutSequence(view, { name: names });

    expect(layout.activations.filter((a) => a.participant === "shop:email-provider")).toEqual([]);
    expect(layout.activations.filter((a) => a.participant === api && a.top === rowOf(layout, "37").y)).toEqual([]);
  });

  it("ends each arrow on the edge of the activation bar it meets, else on the lifeline", () => {
    const layout = layoutSequence(view, { name: names });
    const x = (id: string) => columnOf(layout, id).x;

    // Step 3: Checkout API (bar open since Step 2) calls Auth Service, opening a bar there.
    expect(rowOf(layout, "3").x1).toBe(x(api) + SEQUENCE.bar / 2);
    expect(rowOf(layout, "3").x2).toBe(x("identity:auth") - SEQUENCE.bar / 2);
    // Step 46: async to the Email Provider, whose lifeline has no bar.
    expect(rowOf(layout, "46").x2).toBe(x("shop:email-provider"));
  });

  it("styles each row by what the Step is: sync, async or return", () => {
    const layout = layoutSequence(view, { name: names });
    const style = (key: string) => rowOf(layout, key).style;

    expect([style("2"), style("4"), style("37"), style("46")]).toEqual(["sync", "return", "async", "async"]);
  });

  it("is a pure function: the same View gives the same layout", () => {
    expect(layoutSequence(view, { name: names })).toEqual(layoutSequence(view, { name: names }));
  });
});

describe("Show brokers", () => {
  it("splits each event Step into a publish leg `na` and a deliver leg `nb` through the broker's lifeline", () => {
    const messages = sequenceMessages(view, { brokers: true });
    const legs = messages.filter((m) => m.n === 37 || m.n === 42).map((m) => [m.key, m.from, m.to, m.style]);

    expect(messages).toHaveLength(48);
    expect(legs).toEqual([
      ["37a", "payments:payments-api", "platform:event-bus", "async"],
      ["37b", "platform:event-bus", api, "async"],
      ["42a", "fulfilment:shipping-api", "platform:event-bus", "async"],
      ["42b", "platform:event-bus", api, "async"],
    ]);
  });

  it("adds the broker as a column right after the publisher of its first event Step", () => {
    const layout = layoutSequence(view, { name: names, brokers: true });
    const ids = layout.columns.map((c) => c.id);

    expect(ids).toHaveLength(17);
    expect(ids.indexOf("platform:event-bus")).toBe(ids.indexOf("payments:payments-api") + 1);
    expect(layout.rows.map((r) => r.key)).toContain("42b");
  });

  it("draws one async arrow per event Step without brokers, labelled with the broker and channel", () => {
    const messages = sequenceMessages(view);
    const event = messages.find((m) => m.n === 37)!;

    expect(messages).toHaveLength(46);
    expect(event).toMatchObject({ key: "37", from: "payments:payments-api", to: api, style: "async", via: "platform:event-bus", channel: "payment-events" });
  });
});
