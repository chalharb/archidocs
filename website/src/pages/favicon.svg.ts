/**
 * The site's favicon: the viewer's own (`viewer/public/favicon.svg`), the
 * Archidocs mark drawn to follow the browser's colour scheme. Served from the
 * one file, so the viewer and the docs never drift apart.
 */
import type { APIRoute } from "astro";
import { readRepoFile } from "../lib/repo.ts";

export const GET: APIRoute = () => new Response(readRepoFile("viewer/public/favicon.svg"), { headers: { "Content-Type": "image/svg+xml" } });
