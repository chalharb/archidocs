import { ADVANCES, UNITS_PER_EM } from "./font.ts";

/** A string's width in the embedded font at `size` px. */
export function textWidth(s: string, size: number): number {
  let units = 0;
  for (const ch of s) units += ADVANCES[ch.codePointAt(0)!] ?? ADVANCES[77]!;
  return (units * size) / UNITS_PER_EM;
}

/** `s` if it fits in `max` px, else as much of it as fits followed by an ellipsis. */
export function cut(s: string, size: number, max: number): string {
  if (textWidth(s, size) <= max) return s;
  const chars = [...s];
  while (chars.length > 0 && textWidth(chars.join("").trimEnd() + "…", size) > max) chars.pop();
  return chars.join("").trimEnd() + "…";
}

/** One `<text>` element. */
export function text(x: number, y: number, s: string, { size, fill, anchor }: { size: number; fill: string; anchor?: "end" | "middle" }): string {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${fill}"${anchor ? ` text-anchor="${anchor}"` : ""}>${escape(s)}</text>`;
}

export const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A coordinate to at most two decimals, so output doesn't depend on float noise. */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}
