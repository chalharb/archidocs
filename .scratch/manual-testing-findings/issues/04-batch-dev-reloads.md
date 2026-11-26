# 04: Batch dev reloads during agent edits

Status: ready-for-agent

## Problem

When an agent edits the Workspace over MCP (`upsert_target`, `upsert_deployment`, …), `archidocs dev` reloads the page after every call, so it flickers constantly and loses scroll/zoom.

## Cause

`src/cli/dev.ts:101-111` debounces file events by 80ms, which merges an editor's write-then-rename but not separate tool calls seconds apart. Each new Bundle then triggers a full `location.reload()` (`:55`).

## What to build

Pick one, or both:

1. **Quiet window.** Debounce rebuilds until the Workspace has been quiet for ~1s, with a max wait (~5s) so a long agent session still shows progress.
2. **Swap the Bundle in place.** Instead of `location.reload()`, send `reload` and have the viewer re-fetch `workspace.bundle.json` and re-render, keeping the camera, selection and open boxes. Reload only if the current View no longer exists.

(2) fixes the felt problem (flicker and lost camera) even when updates are frequent; (1) is the smaller change.

## Tests

- `serveDev` test: five file writes 200ms apart broadcast one `reload`, not five.
- If (2): e2e that a Bundle change keeps the viewport.
