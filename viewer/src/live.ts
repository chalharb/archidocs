import { resolveView } from "../../src/core/views/index.ts";
import { fetchReader, openSite } from "../../src/revisions/index.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { parsePlace } from "./place.ts";

declare global {
  interface Window {
    /**
     * Set while the viewer can take a new Bundle in place. `archidocs dev`
     * calls it on each new Bundle and reloads the page when it resolves false.
     */
    __archidocsSwap?: () => Promise<boolean>;
  }
}

/**
 * Lets `archidocs dev` swap a new latest Bundle in without reloading the page,
 * so the camera, selection and open boxes stay. Declines (the page then
 * reloads) when the View on screen is not in the new Bundle. Returns the
 * cleanup that withdraws the offer.
 */
export function acceptLiveBundles(swap: (bundle: Bundle) => void): () => void {
  // Its own reader, asking every time: the page's reader reads the latest Bundle once.
  const fresh = openSite(fetchReader("./"), { recheckMs: 0 });
  const accept = async () => {
    const bundle = await fresh.latest();
    if (resolveView(bundle, parsePlace(window.location.hash).view) === undefined) return false;
    swap(bundle);
    return true;
  };
  window.__archidocsSwap = accept;
  return () => {
    if (window.__archidocsSwap === accept) delete window.__archidocsSwap;
  };
}
