# 18: Saved Views in the viewer

Status: done
Assignee: Claude
Blocked by: 15, 17
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

People find, build and export Saved Views from the viewer.

- The Views tree gains Saved Views grouped by Project. Breadcrumbs read Saved › Project › title. A Saved View opens with its Lens applied, and the Lens can be cleared.
- Shift-click picks nodes, shown with a picked-count chip.
- Export: the whole View or the picks as SVG or PNG, through the shared renderer, with the Lens kept. Picks are laid out again with their open containers.
- Save as View turns the screen into YAML and the matching `upsert_view` call:
  - picks become ids;
  - open boxes become `expand`;
  - an Impact Lens becomes `upstream`/`downstream: all`;
  - a Team Lens becomes `{team}`;
  - Connect to… becomes a path selector;
  - the active Lens becomes `lens:`.

## Acceptance criteria

- [x] Playwright: the YAML that Save as View produces resolves (through the core engine) to the same nodes as the screen.
- [x] An exported SVG from the viewer matches `archidocs export` for the same View.
