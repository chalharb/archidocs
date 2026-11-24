/** The app icon iOS and macOS show for the site and in link previews (`src/lib/share.ts`). */
import type { APIRoute } from "astro";
import { touchIconPng } from "../lib/share-images.ts";

export const GET: APIRoute = async () => new Response(await touchIconPng(), { headers: { "Content-Type": "image/png" } });
