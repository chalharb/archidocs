/**
 * Serves each example's Saved Views as exported by the repo's CLI, at
 * `/diagrams/<example>/<theme>/<file>.svg`. Prerendered into `dist`, so the
 * pictures are build output and never committed.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { exportDiagrams } from "../../../../lib/examples.ts";

export const getStaticPaths = (async () => {
  const diagrams = await exportDiagrams();
  return [...diagrams.entries()].map(([key, svg]) => {
    const [example, theme, view] = key.split("/") as [string, string, string];
    return { params: { example, theme, view }, props: { svg } };
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response((props as { svg: string }).svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
