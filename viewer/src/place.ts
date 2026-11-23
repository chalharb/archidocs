import type { Direction } from "../../src/render/layout.ts";

export type { Direction };
export const directions: readonly Direction[] = ["TB", "BT", "LR", "RL"];

/**
 * Everything on screen, as the URL holds it: the View, its open boxes (in the
 * order they were opened), the selected node and the direction (null for the
 * View's default).
 */
export interface Place {
  view: string;
  open: string[];
  selected: string | null;
  direction: Direction | null;
}

/** Where an empty or unreadable hash lands: the C2 Landscape, every System collapsed. */
export const HOME: Place = { view: "c2", open: [], selected: null, direction: null };

/** A View's direction until the viewer turns it: `TB` for Deployment Views, else `LR`. */
export const defaultDirection = (view: string): Direction => (view.startsWith("deployment/") ? "TB" : "LR");

/** Reads a place from a hash such as `#/view/c2?open=shop:checkout&sel=shop:cart&dir=TB`. */
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
  };
}

/** Writes a place as a hash; ids keep their `:` and `/` so links stay readable. */
export function formatPlace(place: Place): string {
  const query: string[] = [];
  if (place.open.length > 0) query.push(`open=${place.open.map(encode).join(",")}`);
  if (place.selected !== null) query.push(`sel=${encode(place.selected)}`);
  if (place.direction !== null && place.direction !== defaultDirection(place.view)) query.push(`dir=${place.direction}`);
  return `#/view/${encode(place.view)}${query.length > 0 ? `?${query.join("&")}` : ""}`;
}

const encode = (s: string) => encodeURIComponent(s).replace(/%3A/gi, ":").replace(/%2F/gi, "/");

/** Opens a View afresh: nothing open, nothing selected, its default direction. */
export const viewPlace = (view: string, selected: string | null = null): Place => ({ view, open: [], selected, direction: null });
