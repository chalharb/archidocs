import type { Direction } from "../../src/render/layout.ts";
import type { BundleLens } from "../../src/schema/bundle.ts";

export type { Direction };
export type Lens = BundleLens;
export type ImpactWay = "upstream" | "downstream" | "both";
const ways: readonly ImpactWay[] = ["upstream", "downstream", "both"];
export const directions: readonly Direction[] = ["TB", "BT", "LR", "RL"];

/**
 * Everything on screen, as the URL holds it: the View, its open boxes (in the
 * order they were opened), the selected node, the direction (null for the
 * View's default), the Lens and the picked nodes; on a Dynamic View also the
 * selected Step, the Sequence | Graph mode and whether brokers are shown.
 */
export interface Place {
  view: string;
  open: string[];
  selected: string | null;
  direction: Direction | null;
  lens: Lens | null;
  picks: string[];
  /** A Dynamic View's selected Step, by its number. */
  step: number | null;
  /** A Dynamic View drawn as the numbered-Step graph instead of the sequence chart. */
  graph: boolean;
  /** A Dynamic View's event Steps drawn as publish and deliver legs through their broker. */
  brokers: boolean;
}

/** Where an empty or unreadable hash lands: the C2 Landscape, every System collapsed. */
export const HOME: Place = { view: "c2", open: [], selected: null, direction: null, lens: null, picks: [], step: null, graph: false, brokers: false };

/** A View's direction until the viewer turns it: `TB` for Deployment Views, else `LR`. */
export const defaultDirection = (view: string): Direction => (view.startsWith("deployment/") ? "TB" : "LR");

/**
 * Reads a place from a hash such as `#/view/c2?open=shop:checkout&sel=shop:cart&dir=TB`.
 * A Lens is `impact=<id>&way=upstream|downstream|both`, `team=<id>` or
 * `from=<id>&to=<id>&paths=shortest|4`; picks are `picks=a,b`. A Dynamic
 * View adds `step=<n>`, `mode=graph` and `brokers=1`.
 */
export function parsePlace(hash: string): Place {
  const match = /^#\/view\/([^?]*)(?:\?(.*))?$/.exec(hash);
  if (!match) return HOME;
  const params = new URLSearchParams(match[2] ?? "");
  const list = (key: string) => [...new Set((params.get(key) ?? "").split(",").filter(Boolean))];
  const dir = params.get("dir") as Direction | null;
  return {
    view: decodeURIComponent(match[1]!) || HOME.view,
    open: list("open"),
    selected: params.get("sel") || null,
    direction: dir !== null && directions.includes(dir) ? dir : null,
    lens: parseLens(params),
    picks: list("picks"),
    step: positive(params.get("step")),
    graph: params.get("mode") === "graph",
    brokers: params.get("brokers") === "1",
  };
}

function positive(s: string | null): number | null {
  const n = Number(s);
  return s !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function parseLens(params: URLSearchParams): Lens | null {
  const impact = params.get("impact");
  if (impact) {
    const way = params.get("way") as ImpactWay | null;
    return { impact, direction: way !== null && ways.includes(way) ? way : "both" };
  }
  const team = params.get("team");
  if (team) return { team };
  const [from, to] = [params.get("from"), params.get("to")];
  if (from && to) {
    const hops = Number(params.get("paths"));
    return { path: { from, to, paths: Number.isInteger(hops) && hops > 0 ? hops : "shortest" } };
  }
  return null;
}

function formatLens(lens: Lens): string[] {
  if ("impact" in lens) return [`impact=${encode(lens.impact)}`, `way=${lens.direction}`];
  if ("team" in lens) return [`team=${encode(lens.team)}`];
  const { from, to, paths } = lens.path;
  return [`from=${encode(from)}`, `to=${encode(to)}`, ...(paths !== undefined && paths !== "shortest" ? [`paths=${paths}`] : [])];
}

/** Writes a place as a hash; ids keep their `:`, `/` and `@` (a Deployment's `<service>@<target>`) so links stay readable. */
export function formatPlace(place: Place): string {
  const query: string[] = [];
  if (place.open.length > 0) query.push(`open=${place.open.map(encode).join(",")}`);
  if (place.selected !== null) query.push(`sel=${encode(place.selected)}`);
  if (place.direction !== null && place.direction !== defaultDirection(place.view)) query.push(`dir=${place.direction}`);
  if (place.lens !== null) query.push(...formatLens(place.lens));
  if (place.picks.length > 0) query.push(`picks=${place.picks.map(encode).join(",")}`);
  if (place.step !== null) query.push(`step=${place.step}`);
  if (place.graph) query.push("mode=graph");
  if (place.brokers) query.push("brokers=1");
  return `#/view/${encode(place.view)}${query.length > 0 ? `?${query.join("&")}` : ""}`;
}

const encode = (s: string) => encodeURIComponent(s).replace(/%3A/gi, ":").replace(/%2F/gi, "/").replace(/%40/gi, "@");

/** Opens a View afresh: nothing open, nothing selected or picked, its default direction; a Lens carries over when given. */
export const viewPlace = (view: string, selected: string | null = null, lens: Lens | null = null): Place => ({ view, open: [], selected, direction: null, lens, picks: [], step: null, graph: false, brokers: false });
