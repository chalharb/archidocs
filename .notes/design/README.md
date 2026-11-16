# Design

The reference is the Archidocs Prototype (a 1440 × 900 dark screen set in Geist and Geist Mono).
Match the design, not the pixels. Where the prototype and the requirements differ, the
requirements win.

The prototype export is in `.notes/design/prototype/` (open `Main.dc.html` through a static server; see its README). Its inline styles carry the exact values.

## To add

| What                        | Where                       | Status |
| --------------------------- | --------------------------- | ------ |
| Prototype export            | `.notes/design/prototype/`  | Done   |
| Colour, type, radius tokens | `viewer/src/index.css`      | Done   |
| Element-type colours        | `viewer/src/index.css`      | TODO   |
| Geist and Geist Mono fonts  | `.notes/design/fonts/`      | TODO   |
| Logo mark, lockups, PNGs    | `.notes/design/logo/`       | Done   |
| Favicon                     | `viewer/public/favicon.svg` | Done   |

## Theme tokens

The dark theme is defined as Tailwind `@theme` tokens in `viewer/src/index.css`. What is still open is marked
`TODO(design)`. Change values there; component code refers to the token
names (`bg-background`, `text-muted-foreground`, `text-primary`, and so on) and should not change.

Keep text at 4.5:1 contrast or better against its background when you fill in the values.

## Logo

Option C, "Doorway tile": a rounded square tile with an arched doorway cut through it and a violet
keystone above the arch. A light tile on dark backgrounds, a dark tile on light ones. It appears
beside the wordmark in the header, as the favicon and app icons, and on the README and npm page.

## Fonts and logo

Geist (400, 500, 600, 700) is used for interface text and Geist Mono (400, 500) for ids, technology
labels, code and diffs. Both are self-hosted; see decision record 0020.

The logo is the arch-and-keystone mark: tile `#e4e7ef`, arch `#0f172a`, keystone `#818cf8`. The
dark-background lockup is used in the header and the mark is the favicon. Source files, including
PNGs at 256, 512 and 1024 px, are in `.notes/design/logo/`.

## Observed in the prototype

Neutrals are the zinc scale: page `#09090b`, sidebar `#0c0c0e`, cards `#111113`, hover and muted
`#18181b`, borders `#27272a`, text `#fafafa`, secondary text `#d4d4d8` and `#a1a1aa`, focus ring
`#d4d4d8`. Body text is 13px; most small labels are 11 to 12.5px. Radii are 6px for controls, 8px for
cards and 12px for panels. `#71717a` appears for placeholders and fails 4.5:1 on the page
background, so do not use it for text that must be read.

Diagram accents seen in the prototype: blues (`#3557c9`, `#2f86c4`), teal (`#0f8f84`), indigo
(`#5b55d6`) and orange (`#fb923c`). They are not tokens yet; define them with the first slice that
draws a view.
