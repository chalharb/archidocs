# 0020. Self-hosted Geist fonts

- Status: Accepted
- Date: 2026-11-15

## Context and problem statement

The design uses Geist for interface text and Geist Mono for ids, technology labels and code. The prototype loads them from Google Fonts, but the site is a folder of files that may be served on a private network, and a font request to a third party leaks every page view.

## Decision

The viewer bundles the fonts from the `@fontsource/geist` and `@fontsource/geist-mono` packages (Latin subset; Geist weights 400, 500, 600 and 700; Geist Mono weights 400 and 500). Nothing is fetched from another host at run time.

## Consequences

- Good: the site works offline and on private networks, and makes no third-party requests.
- Bad: the font files add to the package size, and font updates arrive through dependency updates.
