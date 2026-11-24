/** The social card link previews show (`src/lib/share.ts`). */
import type { APIRoute } from "astro";
import { shareCardPng } from "../lib/share-images.ts";

export const GET: APIRoute = async () => new Response(await shareCardPng(), { headers: { "Content-Type": "image/png" } });
