# 10: Home is the top-most View

Status: done

## Problem

`/` and the logo both open the C2 Landscape. Home should be the top-most View, the C1 Landscape.

## Where

- `HOME` in `viewer/src/place.ts:99` has `view: "c2"`; the route doc at `:26` says an empty route opens `c2`.
- `viewer/src/Rail.tsx:15,58` (logo) and `viewer/src/App.tsx:49,290` ("Open the C2 Landscape", the Compare start) describe C2 as home.
- `viewer/src/App.tsx:217` falls back to `"c2"` for an Element with no View.

## What to build

- `HOME.view = "c1"`, and update the wording above to C1.
- Keep the PR-Compare start (`App.tsx:49-53`) on C2 if Compare reads better with Services visible; say which in the PR.
- Check `website/` and `docs` for "opens the C2 Landscape".

## Tests

- `viewer-urls.spec.ts` / `navigation.spec.ts`: an empty hash and the logo open `#/view/c1`.

Depends on the outcome of 11 only for wording; can ship first.
