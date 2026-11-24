import { FONTS, UNITS_PER_EM, type FontWeight } from "./font.ts";

const ADVANCES = new Map(FONTS.map((f) => [f.weight, f.advances]));

/** A string's width in the embedded font at `size` px and `weight` (Regular by default). */
export function textWidth(s: string, size: number, weight: FontWeight = 400): number {
  const advances = ADVANCES.get(weight)!;
  let units = 0;
  for (const ch of s) units += advances[ch.codePointAt(0)!] ?? advances[77]!;
  return (units * size) / UNITS_PER_EM;
}

/** `s` if it fits in `max` px, else as much of it as fits followed by an ellipsis. */
export function cut(s: string, size: number, max: number, weight: FontWeight = 400): string {
  if (textWidth(s, size, weight) <= max) return s;
  const chars = [...s];
  while (chars.length > 0 && textWidth(chars.join("").trimEnd() + "…", size, weight) > max) chars.pop();
  return chars.join("").trimEnd() + "…";
}

/** One `<text>` element. */
export function text(x: number, y: number, s: string, { size, fill, anchor, weight = 400 }: { size: number; fill: string; anchor?: "end" | "middle"; weight?: FontWeight }): string {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}"${weight === 400 ? "" : ` font-weight="${weight}"`} fill="${fill}"${anchor ? ` text-anchor="${anchor}"` : ""}>${escape(s)}</text>`;
}

export const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A coordinate to at most two decimals, so output doesn't depend on float noise. */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}
