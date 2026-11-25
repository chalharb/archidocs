/**
 * Serves each screenshot in the shot list (`src/screenshots.ts`) at
 * `/screenshots/<theme>/<id>.png`. Prerendered into `dist`, so the pictures
 * are build output and never committed. A shot that can't be taken fails the
 * build.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { captureScreenshots } from "../../../lib/screenshots.ts";

export const getStaticPaths = (async () => {
  const { images } = await captureScreenshots();
  return [...images.entries()].map(([key, png]) => {
    const [theme, shot] = key.split("/") as [string, string];
    return { params: { theme, shot }, props: { png } };
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(new Uint8Array((props as { png: Buffer }).png), { headers: { "Content-Type": "image/png" } });
