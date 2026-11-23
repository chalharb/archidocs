import type { ReactNode } from "react";

/**
 * The viewer's pictograms, drawn as wayfinding signs are: a 16-unit grid, one 1.75 stroke,
 * square ends and mitred corners, in the current text colour. Decorative; the control names itself.
 */
const PATHS = {
  find: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </>
  ),
  model: <path d="M2.5 3h6M5 3v10.5M5 8.25h7.5M5 13.5h7.5" />,
  teams: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="11" cy="5" r="2" />
      <path d="M1.5 13.5v-1a3.5 3.5 0 0 1 7 0v1M7.5 13.5v-1a3.5 3.5 0 0 1 7 0v1" />
    </>
  ),
  views: <path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />,
  back: <path d="M10 2.5 4.5 8l5.5 5.5" />,
  forward: <path d="M6 2.5 11.5 8 6 13.5" />,
  close: <path d="M3 3l10 10M13 3 3 13" />,
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  copy: <path d="M5.5 5.5h8v8h-8zM2.5 10.5v-8h8" />,
  check: <path d="M2.5 8.5 6 12l7.5-8" />,
  arrow: <path d="M2 8h11M9 4l4 4-4 4" />,
  person: (
    <>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 14v-1.5a5 5 0 0 1 10 0V14" />
    </>
  ),
  system: <path d="M2 2h12v12H2zM5 5h6v6H5z" />,
  // A Service is a hexagon, the deployable unit; a Deployment is that hexagon placed (a square at its centre).
  service: <path d="M8 1.5 14 5v6l-6 3.5L2 11V5z" />,
  component: <path d="M8 2l6 6-6 6-6-6z" />,
  datastore: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </>
  ),
  broker: <path d="M2 4.5h9.5M9 2l2.5 2.5L9 7M14 11.5H4.5M7 9l-2.5 2.5L7 14" />,
  deployment: <path d="M8 1.5 14 5v6l-6 3.5L2 11V5zM6.5 6.5h3v3h-3z" />,
  target: <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />,
  dynamic: <path d="M4 2.5 13 8l-9 5.5z" />,
  play: <path d="M4 2.5 13 8l-9 5.5z" />,
  pause: <path d="M4.5 2.5v11M11.5 2.5v11" />,
  first: <path d="M3.5 2.5v11M13 2.5 6.5 8l6.5 5.5z" />,
  previous: <path d="M12 2.5 5 8l7 5.5z" />,
  next: <path d="M2.5 2.5 8 8l-5.5 5.5zM8.5 2.5 14 8l-5.5 5.5z" />,
  up: <path d="M8 14V3M4 7l4-4 4 4" />,
  down: <path d="M8 2v11M4 9l4 4 4-4" />,
  origin: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
    </>
  ),
  saved: <path d="M4 2h8v12l-4-3-4 3z" />,
  impact: <path d="M8 1.5v13M4 5.5l4-4 4 4M4 10.5l4 4 4-4" />,
  connect: <path d="M2 5h11M10 2l3 3-3 3M14 11H3M6 8l-3 3 3 3" />,
  open: <path d="M9.5 2.5h4v4M13.5 2.5 8 8M7 3.5H2.5v10h10V9" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `arc-icon ${className}` : "arc-icon"} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/** A tree row's or a box's kind, from the glyph the Workspace gives it. */
export const GLYPH_ICON: Record<string, IconName> = {
  "◉": "person",
  "▣": "system",
  "▭": "service",
  "◇": "component",
  "⛁": "target",
  "▶": "dynamic",
};
