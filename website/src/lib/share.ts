/**
 * What a link to the site shows when it is shared: the social card
 * (`/og.png`) and the app icon (`/apple-touch-icon.png`), drawn in
 * `share-images.ts`, and the <head> tags that point at them. Kept apart from
 * the drawing so astro.config.mjs can import it without loading resvg.
 */
export const SHARE_IMAGE = { path: "/og.png", width: 1200, height: 630, alt: "Archidocs: one architecture, the same answer for people and agents" };
export const TOUCH_ICON = { path: "/apple-touch-icon.png", size: 180 };

/** The <head> tags every page carries for link previews. */
export const shareHead = (site: URL) => [
  { tag: "meta", attrs: { property: "og:image", content: new URL(SHARE_IMAGE.path, site).href } },
  { tag: "meta", attrs: { property: "og:image:width", content: String(SHARE_IMAGE.width) } },
  { tag: "meta", attrs: { property: "og:image:height", content: String(SHARE_IMAGE.height) } },
  { tag: "meta", attrs: { property: "og:image:alt", content: SHARE_IMAGE.alt } },
  { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
  { tag: "meta", attrs: { name: "twitter:image", content: new URL(SHARE_IMAGE.path, site).href } },
  { tag: "link", attrs: { rel: "apple-touch-icon", href: TOUCH_ICON.path } },
] as const;
