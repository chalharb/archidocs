import { initWasm, Resvg, type InitInput } from "@resvg/resvg-wasm";
import { FONT_BASE64, FONT_FAMILY } from "./font.ts";

export interface PngOptions {
  /** Pixels per SVG unit; defaults to 2. */
  scale?: number;
}

let initialised: Promise<void> | undefined;
let font: Uint8Array | undefined;

/**
 * Rasterises an SVG from `renderSvg` with resvg (wasm), using only the
 * embedded font and none installed on the machine. `wasm` is resvg's wasm
 * module or where to fetch it; it is used on the first call only.
 */
export async function renderPng(svg: string, wasm: InitInput | Promise<InitInput>, options: PngOptions = {}): Promise<Uint8Array> {
  await (initialised ??= initWasm(wasm));
  font ??= Uint8Array.from(atob(FONT_BASE64), (c) => c.charCodeAt(0));
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: options.scale ?? 2 },
    font: { fontBuffers: [font], defaultFontFamily: FONT_FAMILY, sansSerifFamily: FONT_FAMILY },
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
