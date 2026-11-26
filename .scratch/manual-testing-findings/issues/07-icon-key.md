# 07: Key explains the icons

Status: ready-for-agent

## Problem

Element icons (person, System, Service, database, external hexagon, Deployment Target brackets, …) are not explained anywhere. The Key covers the Team stripe, arrow tile, dashed and striped boxes but no icons.

## What to build

- Add the icons to the Key, one row per icon actually used on the current View (so a C1 key doesn't list database or Target icons). Icons come from `viewer/src/Icon.tsx`.
- Keep the Key compact: a two-column grid of icon + kind name is enough.

## Tests

- e2e: on a View with a Person and a System, the Key lists both icons and not the Deployment Target icon.
