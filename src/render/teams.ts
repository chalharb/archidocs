import type { Bundle } from "../schema/bundle.ts";

/** A Team's stripe colour, always shown with its code. */
export interface TeamStyle {
  code: string;
  color: string;
}

/**
 * Each Team's stripe colour and code. Colours are spaced by the golden angle
 * in OKLCH hue, in the Bundle's Team order; a code is the initials of a
 * Team's name of two words or more, else its first three letters.
 */
export function teamStyles(bundle: Pick<Bundle, "teams">): Map<string, TeamStyle> {
  return new Map(
    bundle.teams.map((t, i) => {
      const words = t.name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const code = (words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 3) : (words[0] ?? t.id).slice(0, 3)).toUpperCase();
      return [t.id, { code, color: oklchToHex(0.62, 0.13, (30 + i * 137.508) % 360) }];
    }),
  );
}

/** An OKLCH colour as sRGB hex, clamped into gamut. */
function oklchToHex(l: number, c: number, hue: number): string {
  const h = (hue * Math.PI) / 180;
  const [a, b] = [c * Math.cos(h), c * Math.sin(h)];
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return `#${linear
    .map((v) => {
      const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, srgb)) * 255).toString(16).padStart(2, "0");
    })
    .join("")}`;
}
