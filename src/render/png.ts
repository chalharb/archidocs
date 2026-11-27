import { initWasm, Resvg, type InitInput } from "@resvg/resvg-wasm";
import { FONT_FAMILY, FONTS } from "./font.ts";

export interface PngOptions {
  /** Pixels per SVG unit; defaults to 2. */
  scale?: number;
}

let initialised: Promise<void> | undefined;
let fonts: Uint8Array[] | undefined;

/**
 * Rasterises an SVG from `renderSvg` with resvg (wasm), using only the
 * embedded fonts and none installed on the machine. `wasm` is resvg's wasm
 * module or where to fetch it; it is used on the first call only.
 */
export async function renderPng(svg: string, wasm: InitInput | Promise<InitInput>, options: PngOptions = {}): Promise<Uint8Array> {
  // A failed load clears the cache so the next call retries; `wasm` rejecting is handled the same way, as initWasm awaits it.
  await (initialised ??= initWasm(wasm).catch((error: unknown) => {
    initialised = undefined;
    throw error;
  }));
  fonts ??= FONTS.map((f) => Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0)));
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: options.scale ?? 2 },
    font: { fontBuffers: fonts, defaultFontFamily: FONT_FAMILY, sansSerifFamily: FONT_FAMILY },
  });
  try {
    const image = resvg.render();
    try {
      return image.asPng();
    } finally {
      image.free();
    }
  } finally {
    resvg.free();
  }
}
