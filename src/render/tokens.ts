/**
 * The diagram palette: the Wayfinding Plate tokens (DESIGN.md) that a drawn
 * View uses, in light and in "Night shift" dark. This is the one source for
 * `renderSvg` and `renderSequenceSvg`; the viewer's CSS custom properties of
 * the same names in `viewer/src/styles.css` are checked against it by
 * `test/render/tokens.test.ts`, so the export and the viewer can't drift.
 */
export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

/** Each token by its CSS custom property name, without the leading `--`. */
export interface Palette {
  /** The canvas: the pale stone ground the map sits on. */
  ground: string;
  /** Nodes, headers, the key. */
  paper: string;
  /** Station Slate: text and every 1.5px frame. */
  ink: string;
  muted: string;
  faint: string;
  /** Quiet frames: Deployment Targets, open boxes and stepped-back nodes. */
  line: string;
  /** Hairlines and broker stripes. */
  rule: string;
  /** A collapsed System's fill, activation bars. */
  tint: string;
  /** Wayfinding Yellow: the lens origin ring, and nothing decorative. */
  here: string;
  /** Text on the yellow. */
  "on-here": string;
  herebg: string;
  "code-bg": string;
  "code-fg": string;
  /** Upstream Rust and Downstream Blue: the Impact lens sides. */
  up: string;
  upbg: string;
  down: string;
  downbg: string;
  /** Path Violet: a path lens. */
  path: string;
  pathbg: string;
  edge: string;
  /** A stepped-back edge: solid, fainter, never faded or dashed. */
  "edge-faint": string;
  /** An open box's translucent tint, as the viewer's CSS writes it. */
  container: string;
  /** Target Depth grounds: a Deployment Target's fill, one step off its parent's per nesting level (see `targetStep`). */
  "target-1": string;
  "target-2": string;
  "target-3": string;
}

/** How many Target Depth grounds there are; Targets nested deeper reuse the last. */
export const TARGET_STEPS = 3;

/** The Target Depth ground a Deployment Target at `depth` (1 for an outermost Target) draws on: 1 to `TARGET_STEPS`. */
export function targetStep(depth: number): 1 | 2 | 3 {
  return Math.min(Math.max(depth, 1), TARGET_STEPS) as 1 | 2 | 3;
}

export const PALETTES: Record<Theme, Palette> = {
  light: {
    ground: "#f3f4f1",
    paper: "#ffffff",
    ink: "#1c2633",
    muted: "#4f5966",
    faint: "#616a76",
    line: "#c4c9c1",
    rule: "#e2e4df",
    tint: "#e8eae5",
    here: "#ffc629",
    "on-here": "#1c2633",
    herebg: "#fff4cc",
    "code-bg": "#1c2633",
    "code-fg": "#ffffff",
    up: "#a4461a",
    upbg: "#fbeee6",
    down: "#1d5fa8",
    downbg: "#e8f0fa",
    path: "#5b3aa8",
    pathbg: "#efeaf9",
    edge: "#5b6573",
    "edge-faint": "#80878f",
    container: "rgba(232, 234, 229, 0.6)",
    "target-1": "#ebede8",
    "target-2": "#e2e5df",
    "target-3": "#d9ddd6",
  },
  dark: {
    ground: "#10151c",
    paper: "#18202a",
    ink: "#e6eaef",
    muted: "#a9b2bd",
    faint: "#8f99a5",
    line: "#36414f",
    rule: "#252e3a",
    tint: "#232c38",
    here: "#ffc629",
    "on-here": "#10151c",
    herebg: "#3a3216",
    "code-bg": "#e6eaef",
    "code-fg": "#10151c",
    up: "#f0925f",
    upbg: "#3a2419",
    down: "#78aef5",
    downbg: "#172a45",
    path: "#b79cff",
    pathbg: "#2a2142",
    edge: "#8f99a5",
    "edge-faint": "#646d78",
    container: "rgba(35, 44, 56, 0.55)",
    "target-1": "#0d1117",
    "target-2": "#0a0d12",
    "target-3": "#06080c",
  },
};

/**
 * `rgba(r, g, b, a)` painted over a solid hex colour, as one solid hex. The
 * export flattens the open-box tint onto the ground this way, so no element
 * in it carries an opacity below 1.
 */
export function flatten(rgba: string, under: string): string {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(rgba);
  if (!m) return rgba;
  const alpha = Number(m[4]);
  const base = [1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16));
  return `#${[m[1], m[2], m[3]].map((c, i) => Math.round(Number(c) * alpha + base[i]! * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}
