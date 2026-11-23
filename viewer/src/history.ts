import { useMemo, useSyncExternalStore } from "react";
import { formatPlace, parsePlace, type Place } from "./place.ts";

const CHANGED = "archidocs:place";

function subscribe(onChange: () => void) {
  for (const event of ["hashchange", "popstate", CHANGED]) window.addEventListener(event, onChange);
  return () => {
    for (const event of ["hashchange", "popstate", CHANGED]) window.removeEventListener(event, onChange);
  };
}

/** The current hash; links, back and forward all change it. */
export const useHash = () => useSyncExternalStore(subscribe, () => window.location.hash);

/**
 * The place the URL holds. The same object until the hash changes, so callbacks
 * and memos built from it don't change on every render: a new one would rebuild
 * every canvas node, and React Flow hides edges until it re-measures them.
 */
export function usePlace(): Place {
  const hash = useHash();
  return useMemo(() => parsePlace(hash), [hash]);
}

/**
 * Moves to a place. A new View or new open boxes push a history entry, so
 * back returns to them; selection replaces the current entry.
 */
export function go(place: Place, { replace = false } = {}) {
  const hash = formatPlace(place);
  if (hash === window.location.hash) return;
  if (replace) window.history.replaceState(null, "", hash);
  else window.history.pushState(null, "", hash);
  window.dispatchEvent(new Event(CHANGED));
}
