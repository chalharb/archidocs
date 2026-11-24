/**
 * The landing page's map: the build's light export of the Saved View it asks
 * about (see `exportDiagrams`), cropped to its nodes by `cropDiagram`.
 */
import type { APIRoute } from "astro";
import { landingDiagram } from "../../lib/landing.ts";

export const GET: APIRoute = async () => new Response((await landingDiagram()).svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
