# Design

The reference is the Archidocs Prototype (a 1440 × 900 dark screen set in Geist and Geist Mono).
Match the design, not the pixels. Where the prototype and the requirements differ, the
requirements win.

Everything below is a placeholder until the prototype is exported.

## To add

| What                       | Where                       | Status |
| -------------------------- | --------------------------- | ------ |
| Screenshots of each screen | `.notes/design/screens/`    | TODO   |
| Colour tokens              | `viewer/src/index.css`      | TODO   |
| Type scale                 | `viewer/src/index.css`      | TODO   |
| Spacing and radius tokens  | `viewer/src/index.css`      | TODO   |
| Geist and Geist Mono fonts | `.notes/design/fonts/`      | TODO   |
| Logo mark, lockups, PNGs   | `.notes/design/logo/`       | Done   |
| Favicon                    | `viewer/public/favicon.svg` | Done   |

## Theme tokens

The dark theme is defined as Tailwind `@theme` tokens in `viewer/src/index.css`. Each placeholder
value is marked `TODO(design)`. Replace the values there; component code refers to the token
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
