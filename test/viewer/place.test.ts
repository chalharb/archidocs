import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPlace, HOME, parsePlace, URL_PARAMETERS, VIEW_ROUTE } from "../../viewer/src/place.ts";

/**
 * One hash per listed parameter, with what it needs beside it (`way` reads
 * only with `impact`). Each must parse to a place that formats back to it.
 */
const samples: Record<string, string> = {
  open: "open=shop:checkout,payments:payments",
  sel: "sel=shop:cart",
  dir: "dir=LR",
  impact: "impact=shop:cart&way=both",
  way: "impact=shop:cart&way=upstream",
  team: "team=payments-team",
  from: "from=shop:web&to=payments:payments",
  to: "from=shop:web&to=payments:payments",
  paths: "from=shop:web&to=payments:payments&paths=4",
  picks: "picks=shop:cart,shop:web",
  step: "step=3",
  mode: "mode=graph",
  brokers: "brokers=1",
  at: "at=v1",
  vs: "vs=2025-07-21",
  adr: "adr=shop:0002",
};

const names = URL_PARAMETERS.map((p) => p.name);
const hash = (view: string, query = "") => `${VIEW_ROUTE.prefix}${view}${query ? `?${query}` : ""}`;

/** The query parameters `parsePlace` reads while parsing `h`. */
function keysRead(h: string): Set<string> {
  const read = new Set<string>();
  for (const method of ["get", "getAll", "has"] as const) {
    const original = URLSearchParams.prototype[method] as (this: URLSearchParams, name: string) => unknown;
    vi.spyOn(URLSearchParams.prototype, method).mockImplementation(function (this: URLSearchParams, name: string) {
      read.add(name);
      return original.call(this, name);
    } as never);
  }
  parsePlace(h);
  vi.restoreAllMocks();
  return read;
}

afterEach(() => vi.restoreAllMocks());

describe("the parameter list", () => {
  it("names each parameter once, with its values and what it does", () => {
    expect(new Set(names).size).toBe(names.length);
    for (const p of URL_PARAMETERS) {
      expect(p.values.trim(), p.name).not.toBe("");
      expect(p.does.trim(), p.name).not.toBe("");
    }
  });

  it("has a sample here for every listed parameter", () => {
    expect(Object.keys(samples).sort()).toEqual([...names].sort());
  });

  it("holds every parameter the parser reads", () => {
    const every = hash("c2", Object.values(samples).join("&"));
    const queries = [every, ...Object.values(samples).map((q) => hash("c2", q)), hash("c2"), "#/nowhere"];
    for (const h of queries) for (const key of keysRead(h)) expect(names, `parsePlace reads "${key}"`).toContain(key);
  });

  it("is read in full by the parser", () => {
    const read = new Set(Object.values(samples).flatMap((q) => [...keysRead(hash("c2", q))]));
    for (const name of names) expect(read, name).toContain(name);
  });
});

describe("parsing and formatting", () => {
  it.each(Object.entries(samples))("%s round-trips", (name, query) => {
    const h = hash("c2", query);
    expect(formatPlace(parsePlace(h))).toBe(h);
    expect(parsePlace(h), `${name} changes nothing`).not.toEqual(parsePlace(hash("c2", query.replace(new RegExp(`(^|&)${name}=[^&]*`), ""))));
  });

  it("round-trips every parameter at once, in the list's order", () => {
    const query = ["open", "sel", "dir", "picks", "step", "mode", "brokers", "at", "vs", "adr"].map((n) => samples[n]).join("&");
    const ordered = parsePlace(hash("c2", query));
    expect(formatPlace(ordered)).toBe(
      hash("c2", "open=shop:checkout,payments:payments&sel=shop:cart&dir=LR&picks=shop:cart,shop:web&step=3&mode=graph&brokers=1&at=v1&vs=2025-07-21&adr=shop:0002"),
    );
  });

  it("formats the route from VIEW_ROUTE, keeping `/`, `:` and `@` in ids", () => {
    expect(formatPlace({ ...HOME, view: "c2/shop:checkout" })).toBe(`${VIEW_ROUTE.prefix}c2/shop:checkout`);
    expect(formatPlace({ ...HOME, view: "deployment/prod", picks: ["shop:cart@platform:eks-prod"] })).toBe(`${VIEW_ROUTE.prefix}deployment/prod?picks=shop:cart@platform:eks-prod`);
    expect(VIEW_ROUTE.syntax).toBe(`${VIEW_ROUTE.prefix}<view-id>`);
  });
});

describe("what existing URLs mean", () => {
  it("lands an empty or foreign hash on the C2 Landscape", () => {
    expect(parsePlace("")).toEqual(HOME);
    expect(parsePlace("#/elsewhere/c3")).toEqual(HOME);
    expect(parsePlace("#/view/")).toEqual(HOME);
  });

  it("reads an Impact Lens with no way as both ways, and an unknown way as both", () => {
    expect(parsePlace("#/view/c2?impact=shop:cart").lens).toEqual({ impact: "shop:cart", direction: "both" });
    expect(parsePlace("#/view/c2?impact=shop:cart&way=sideways").lens).toEqual({ impact: "shop:cart", direction: "both" });
  });

  it("prefers impact over team over a path, and needs both ends of a path", () => {
    expect(parsePlace("#/view/c2?team=t&impact=a").lens).toEqual({ impact: "a", direction: "both" });
    expect(parsePlace("#/view/c2?from=a&to=b&team=t").lens).toEqual({ team: "t" });
    expect(parsePlace("#/view/c2?from=a").lens).toBeNull();
    expect(parsePlace("#/view/c2?from=a&to=b").lens).toEqual({ path: { from: "a", to: "b", paths: "shortest" } });
    expect(formatPlace(parsePlace("#/view/c2?from=a&to=b&paths=shortest"))).toBe("#/view/c2?from=a&to=b");
  });

  it("ignores an unknown direction, a step that isn't a positive whole number, and other mode and brokers values", () => {
    const place = parsePlace("#/view/c2?dir=UP&step=0&mode=sequence&brokers=yes");
    expect(place).toEqual({ ...HOME });
    expect(parsePlace("#/view/c2?step=2.5").step).toBeNull();
  });

  it("drops repeated and empty ids from lists, and decodes the View id", () => {
    expect(parsePlace("#/view/c2?open=a,,a,b&picks=").open).toEqual(["a", "b"]);
    expect(parsePlace("#/view/c2%2Fshop%3Acheckout").view).toBe("c2/shop:checkout");
  });
});
