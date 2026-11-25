/**
 * The shot list: every screenshot of the viewer that pages show with
 * `<Screenshot id="…" alt="…" />`. The docs build opens each shot's URL on
 * its example's site, in light and dark, and serves the pictures from
 * `/screenshots/<theme>/<id>.png` (`lib/screenshots.ts`). They are never
 * committed.
 *
 * To add a shot, add a line here: an id, the example Workspace
 * (`big-bank`, `kitchen-sink` or `quick-start`), the viewer URL (the part
 * after the site's address, as the viewer's location bar shows it) and the
 * window size. A shot of a demo links to the same URL on the live demo.
 */
import type { Shot } from "./lib/screenshots.ts";

/** A desktop window that fits the docs' content column at twice its pixels. */
const DOCS = { width: 1024, height: 640 } as const;

export const SHOTS: readonly Shot[] = [
  { id: "quick-start-landscape", example: "quick-start", url: "#/view/c2", viewport: DOCS },
  { id: "quick-start-online-shop", example: "quick-start", url: "#/view/c2/shop:online-shop", viewport: DOCS },
];
