import { formatPlace, type Place } from "./place.ts";

export interface RecentPlace {
  /** The View and its open boxes: one entry per place, whatever is selected in it. */
  key: string;
  hash: string;
  label: string;
}

const LIMIT = 10;

/** One list per site, so two sites on one host (as on Pages) don't share one. */
const storageKey = () => `archidocs:recent:${window.location.pathname.replace(/index\.html$/, "")}`;

export function readRecent(): RecentPlace[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(storageKey()) ?? "[]") as unknown;
    return Array.isArray(list) ? (list as RecentPlace[]).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

/** Puts a place first, dropping its earlier entry and anything past the last 10. */
export function remember(place: Place, title: string): void {
  const key = `${place.view}?${place.open.join(",")}|${place.closed.join(",")}`;
  const state = [place.open.length > 0 ? `${place.open.length} open` : "", place.closed.length > 0 ? `${place.closed.length} closed` : ""].filter(Boolean);
  const label = [title, ...state].join(" · ");
  const list = [{ key, hash: formatPlace(place), label }, ...readRecent().filter((r) => r.key !== key)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(list));
  } catch {
    // Storage can be full or blocked; Recent is a convenience, so the screen carries on without it.
  }
}
