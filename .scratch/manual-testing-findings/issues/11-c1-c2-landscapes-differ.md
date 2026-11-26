# 11: C1 and C2 Landscapes differ

Status: done

## Problem

The C1 and C2 Landscapes look identical (same Persons, the System, Entra ID). The only difference is C2's `+` to open a System.

## Cause

`src/core/views/generated.ts:15,48` builds both with `landscape()`: every top-level Element. C1 ignores `expand`; C2 honours it. With nothing expanded, they are the same picture.

## Decisions

- **The C2 Landscape opens every System by default**: Services shown inside their Systems, with Persons and external Elements around them. `−` closes a System. This matches Saved Views, where `level: c2` already means "Services, grouped in their Systems".
- **URL:** a new `closed=` parameter lists Systems closed on the C2 Landscape, mirroring Saved Views' `collapse`. `open=` keeps its meaning (opened one level further, e.g. a Service down to its Components), so existing `#/view/c2?open=…` links mean what they said.
- **Save as View** from the C2 Landscape writes `closed` as the Saved View's `collapse`.
- The C1 Landscape is unchanged.

## What to build

- Core: the generated C2 Landscape opens every System unless closed. Give `landscape()` (or the View resolve options) a `collapse` list alongside `expand`. CLI export of `c2` draws Systems open.
- Viewer: `closed` in `Place` (`viewer/src/place.ts`), parsed and written, listed in `URL_PARAMETERS` with its `does` text; the `+`/`−` toggle on the C2 Landscape adds/removes from `closed`; `viewer/src/SaveAsView.tsx` / `src/core/views/save-as-view.ts` map it to `collapse`.
- MCP `get_view` on `c2` returns the open picture.
- Docs/website wording that says the C2 Landscape shows only Systems.

## Tests

- Core: `c2` with no options shows every System's Services; `collapse: [sys]` hides that System's Services; `c1` unchanged.
- Place: `closed` round-trips through `parsePlace` / `formatPlace`.
- Save as View: a C2 Landscape with one System closed saves `collapse: [that system]`.
- e2e: `−` on a System on the C2 Landscape closes it and adds it to `closed=` in the URL; reload keeps it closed.
- Golden `test/render/golden/` for `c2` if one exists.
