/** The social card link previews show (`src/lib/share.ts`). Copied into an ArrayBuffer-backed array, the body type Response takes. */
import type { APIRoute } from "astro";
import { shareCardPng } from "../lib/share-images.ts";

export const GET: APIRoute = async () => new Response(new Uint8Array(await shareCardPng()), { headers: { "Content-Type": "image/png" } });
