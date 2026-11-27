import type { Direction } from "../../src/render/layout.ts";
import type { BundleLens } from "../../src/schema/bundle.ts";
import { POINT_GRAMMAR } from "../../src/revisions/index.ts";

export type { Direction };
export type Lens = BundleLens;
export type ImpactWay = "upstream" | "downstream" | "both";
const ways: readonly ImpactWay[] = ["upstream", "downstream", "both"];
export const directions: readonly Direction[] = ["TB", "BT", "LR", "RL"];
/** The values of `paths`, `mode` and `brokers` that aren't numbers, shared by the parser, the formatter and the list. */
const SHORTEST = "shortest";
const GRAPH = "graph";
const BROKERS_ON = "1";

/** Values as a sentence: `` `a`, `b` or `c` ``. */
const oneOf = (values: readonly (string | number)[]): string => {
  const code = values.map((v) => `\`${v}\``);
  return code.length < 2 ? code.join("") : `${code.slice(0, -1).join(", ")} or ${code.at(-1)}`;
};

/** The route every place sits under: a View, by id. Query parameters follow a `?`. */
const ROUTE_PREFIX = "#/view/";
export const VIEW_ROUTE = {
  prefix: ROUTE_PREFIX,
  syntax: `${ROUTE_PREFIX}<view-id>`,
  does: "Opens the View with this id: `c2`, a Generated View such as `c2/payments:payments` or `deployment/prod`, or a Saved View's qualified id. An empty route opens the top-most View, the C1 Landscape `c1`.",
} as const;

/** A query parameter the viewer reads from its URL. */
export interface UrlParameter {
  name: string;
  /** The values it takes, as Markdown. */
  values: string;
  /** What it does on screen, as Markdown. */
  does: string;
}

/**
 * Every query parameter the viewer reads, in the order it writes them.
 * `parsePlace` and `formatPlace` read and write only these names, and the
 * docs' viewer URL reference is generated from this list.
 */
/** The point grammar as a values cell. */
const POINT = POINT_GRAMMAR.charAt(0).toUpperCase() + POINT_GRAMMAR.slice(1);

export const URL_PARAMETERS = [
  { name: "open", values: "Element ids, separated by commas", does: "Opens these boxes to show what is inside them, in the order they were opened." },
  { name: "closed", values: "System ids, separated by commas", does: "Closes these Systems on the C2 Landscape, which opens every other System. Read on no other View." },
  { name: "sel", values: "An Element id", does: "Selects this node and shows it in the Element panel." },
  { name: "rel", values: "Two node ids, separated by a comma", does: "Selects the edge from the first node to the second and shows its Relationships in the Relationship panel. Read only without `sel`." },
  { name: "dir", values: oneOf(directions), does: "Lays the View out in this direction. Left out, the View's own direction." },
  { name: "impact", values: "An Element id", does: "Turns on the Impact Lens around this Element." },
  { name: "way", values: oneOf(ways), does: "Which way the Impact Lens looks. Left out, `both`. Read only with `impact`." },
  { name: "team", values: "A Team id", does: "Turns on the Team Lens: what this Team owns. Read only without `impact`." },
  { name: "from", values: "An Element id", does: "Turns on the Connect to… Lens: the paths from this Element to the one `to` names. Read only without `impact` and `team`." },
  { name: "to", values: "An Element id", does: "The other end of the Connect to… Lens. Read only with `from`." },
  { name: "paths", values: `${oneOf([SHORTEST])}, or a whole number of hops`, does: "Which paths the Connect to… Lens lights: the shortest, however long, or every path of at most that many hops. Left out, `shortest`." },
  { name: "picks", values: "Element or Deployment ids, separated by commas", does: "Picks these nodes, as Save as View and downloads use them." },
  { name: "step", values: "A whole number from 1", does: "Selects this Step of a Dynamic View." },
  { name: "mode", values: oneOf([GRAPH]), does: "Draws a Dynamic View as the graph of numbered Steps instead of the sequence chart." },
  { name: "brokers", values: oneOf([BROKERS_ON]), does: "Draws a Dynamic View's event Steps as publish and deliver legs through their broker." },
  { name: "at", values: POINT, does: "Shows the whole viewer at this past Revision." },
  { name: "vs", values: POINT, does: "Compares against this Revision: what changed from it to `at`, or to the latest." },
  { name: "adr", values: "An ADR's qualified id, such as `payments:0001`", does: "Opens this ADR in the reader." },
] as const satisfies readonly UrlParameter[];

export type UrlParameterName = (typeof URL_PARAMETERS)[number]["name"];

/** Whether a hash names a place: it starts with the View route. */
export const isPlaceHash = (hash: string): boolean => hash.startsWith(VIEW_ROUTE.prefix);

/**
 * Everything on screen, as the URL holds it: the View, its open boxes (in the
 * order they were opened) and, on the C2 Landscape, its closed Systems, the selected node, the direction (null for the
 * View's default), the Lens and the picked nodes; on a Dynamic View also the
 * selected Step, the Sequence | Graph mode and whether brokers are shown;
 * and the ADR open in the reader.
 */
export interface Place {
  view: string;
  open: string[];
  /** Systems closed on the C2 Landscape, which opens every other System; read on no other View. */
  closed: string[];
  selected: string | null;
  /** The selected edge, by its two nodes; never set with `selected`. */
  edge: EdgeRef | null;
  direction: Direction | null;
  lens: Lens | null;
  picks: string[];
  /** A Dynamic View's selected Step, by its number. */
  step: number | null;
  /** A Dynamic View drawn as the numbered-Step graph instead of the sequence chart. */
  graph: boolean;
  /** A Dynamic View's event Steps drawn as publish and deliver legs through their broker. */
  brokers: boolean;
  /** A past Revision the whole viewer shows (a tag, sha or date); null for the latest. */
  at: string | null;
  /** A Revision to Compare against: Compare shows what changed from it to `at` (or the latest). */
  vs: string | null;
  /** The ADR open in the reader, by its qualified id. */
  adr: string | null;
}

/** An edge of a View, by the nodes at its two ends. */
export interface EdgeRef {
  from: string;
  to: string;
}

/** Where an empty or unreadable hash lands: the top-most View, the C1 Landscape. */
export const HOME: Place = { view: "c1", open: [], closed: [], selected: null, edge: null, direction: null, lens: null, picks: [], step: null, graph: false, brokers: false, at: null, vs: null, adr: null };

/** The route, then the View id up to the first `?`, then the query. */
const ROUTE_PATTERN = new RegExp(`^${ROUTE_PREFIX}([^?]*)(?:\\?(.*))?$`);

/**
 * Reads a place from a hash such as `#/view/c2?open=shop:cart&closed=payments:payments&sel=shop:cart&dir=TB`.
 * A Lens is `impact=<id>&way=upstream|downstream|both`, `team=<id>` or
 * `from=<id>&to=<id>&paths=shortest|4`; picks are `picks=a,b`. A Dynamic
 * View adds `step=<n>`, `mode=graph` and `brokers=1`; an open ADR is `adr=<id>`.
 * `at=<point>` shows a past Revision and `vs=<point>` Compares against one.
 */
export function parsePlace(hash: string): Place {
  const match = ROUTE_PATTERN.exec(hash);
  if (!match) return HOME;
  const params = new URLSearchParams(match[2] ?? "");
  const get = (name: UrlParameterName) => params.get(name);
  const list = (name: UrlParameterName) => [...new Set((get(name) ?? "").split(",").filter(Boolean))];
  const dir = get("dir") as Direction | null;
  return {
    view: decodeURIComponent(match[1]!) || HOME.view,
    open: list("open"),
    closed: list("closed"),
    selected: get("sel") || null,
    edge: get("sel") ? null : parseEdge(get("rel")),
    direction: dir !== null && directions.includes(dir) ? dir : null,
    lens: parseLens(get),
    picks: list("picks"),
    step: positive(get("step")),
    graph: get("mode") === GRAPH,
    brokers: get("brokers") === BROKERS_ON,
    at: get("at") || null,
    vs: get("vs") || null,
    adr: get("adr") || null,
  };
}

function parseEdge(s: string | null): EdgeRef | null {
  const [from, to, ...rest] = (s ?? "").split(",");
  return from && to && rest.length === 0 ? { from, to } : null;
}

function positive(s: string | null): number | null {
  const n = Number(s);
  return s !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function parseLens(get: (name: UrlParameterName) => string | null): Lens | null {
  const impact = get("impact");
  if (impact) {
    const way = get("way") as ImpactWay | null;
    return { impact, direction: way !== null && ways.includes(way) ? way : "both" };
  }
  const team = get("team");
  if (team) return { team };
  const [from, to] = [get("from"), get("to")];
  if (from && to) {
    const hops = Number(get("paths"));
    return { path: { from, to, paths: Number.isInteger(hops) && hops > 0 ? hops : SHORTEST } };
  }
  return null;
}

/** One `name=value` pair; `value` is already encoded. */
const pair = (name: UrlParameterName, value: string | number): string => `${name}=${value}`;

function formatLens(lens: Lens): string[] {
  if ("impact" in lens) return [pair("impact", encode(lens.impact)), pair("way", lens.direction)];
  if ("team" in lens) return [pair("team", encode(lens.team))];
  const { from, to, paths } = lens.path;
  return [pair("from", encode(from)), pair("to", encode(to)), ...(paths !== undefined && paths !== SHORTEST ? [pair("paths", paths)] : [])];
}

/** Writes a place as a hash; ids keep their `:`, `/` and `@` (a Deployment's `<service>@<target>`) so links stay readable. */
export function formatPlace(place: Place): string {
  const query: string[] = [];
  if (place.open.length > 0) query.push(pair("open", place.open.map(encode).join(",")));
  if (place.closed.length > 0) query.push(pair("closed", place.closed.map(encode).join(",")));
  if (place.selected !== null) query.push(pair("sel", encode(place.selected)));
  if (place.edge !== null && place.selected === null) query.push(pair("rel", `${encode(place.edge.from)},${encode(place.edge.to)}`));
  if (place.direction !== null) query.push(pair("dir", place.direction));
  if (place.lens !== null) query.push(...formatLens(place.lens));
  if (place.picks.length > 0) query.push(pair("picks", place.picks.map(encode).join(",")));
  if (place.step !== null) query.push(pair("step", place.step));
  if (place.graph) query.push(pair("mode", GRAPH));
  if (place.brokers) query.push(pair("brokers", BROKERS_ON));
  if (place.at !== null) query.push(pair("at", encode(place.at)));
  if (place.vs !== null) query.push(pair("vs", encode(place.vs)));
  if (place.adr !== null) query.push(pair("adr", encode(place.adr)));
  return `${VIEW_ROUTE.prefix}${encode(place.view)}${query.length > 0 ? `?${query.join("&")}` : ""}`;
}

const encode = (s: string) => encodeURIComponent(s).replace(/%3A/gi, ":").replace(/%2F/gi, "/").replace(/%40/gi, "@");

/**
 * Opens a View afresh: nothing opened or closed, nothing selected or picked, its default
 * direction, no ADR; a Lens carries over when given, and `at` and `vs` from
 * the place it is opened from, so moving around stays at the same Revisions.
 */
export const viewPlace = (view: string, selected: string | null = null, lens: Lens | null = null, from?: Pick<Place, "at" | "vs">): Place => ({
  view,
  open: [],
  closed: [],
  selected,
  edge: null,
  direction: null,
  lens,
  picks: [],
  step: null,
  graph: false,
  brokers: false,
  at: from?.at ?? null,
  vs: from?.vs ?? null,
  adr: null,
});
