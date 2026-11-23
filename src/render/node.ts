import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { renderPng, type PngOptions } from "./png.ts";

/** `renderPng` with resvg's wasm read from its installed package; Node only. */
export function renderPngInNode(svg: string, options: PngOptions = {}): Promise<Uint8Array> {
  const wasm = readFile(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"));
  return renderPng(svg, wasm, options);
}
