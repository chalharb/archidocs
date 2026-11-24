/** The app icon iOS and macOS show for the site and in link previews (`src/lib/share.ts`). Copied into an ArrayBuffer-backed array, the body type Response takes. */
import type { APIRoute } from "astro";
import { touchIconPng } from "../lib/share-images.ts";

export const GET: APIRoute = async () => new Response(new Uint8Array(await touchIconPng()), { headers: { "Content-Type": "image/png" } });
