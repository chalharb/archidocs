# 15: Generated viewer screenshots

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The docs have no picture of the viewer. Hand-taken screenshots would go stale, so generate them, as diagrams are exported today.

- **Shot list:** one file naming each shot: an id, the example (`big-bank`, `kitchen-sink`, `quick-start`), the viewer URL, and the viewport size.
- **Capture:** a Playwright script builds each example's site with the repo's own CLI, opens each shot's URL in light and dark, waits for layout to settle with reduced motion on, and writes the images as build assets. They're never committed.
- **Component:** `<Screenshot id="…" alt="…" />`, like `<Diagram>`: both themes, swapped on Starlight's `[data-theme]`, with a link that opens the same URL on the live demo.
- **Markdown copies:** `src/render-markdown.ts` renders a screenshot as an image and a link.
- **Build cost:** cache the images on a hash of the viewer build and the example, so an unchanged viewer isn't captured again. The docs build in CI needs Chromium installed.
- **First use:** replace the diagram on the quick start (02) with a screenshot.

## Acceptance criteria

- [x] A page using `<Screenshot>` shows the viewer in light and dark.
- [x] The build fails on an unknown shot id, and on a shot whose URL shows the viewer's empty or error state.
- [x] Two builds of the same commit produce the same images.
- [x] The `.md` copy of a page with a screenshot holds an image link.
- [x] The docs build in CI and for PR previews still passes.
