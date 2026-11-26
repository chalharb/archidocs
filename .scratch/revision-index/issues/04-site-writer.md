# 04: One site writer

Status: done
Blocked by: 03, workspace-checkout 04
Spec: [Revision index](../spec.md)

## What to build

One function writes a site to disk, and the module gives the text of every file in it. PR title: `refactor(history): ...`. Output on disk is byte-identical.

### In the module

The text of the three small files, each exactly as written today:
- the latest Bundle: `serializeBundle`, moved from `src/core/load.ts:494` or re-exported;
- `site.json`: `JSON.stringify({ workspace }) + "\n"`;
- the index: `JSON.stringify(index, null, 2) + "\n"`.

### `writeSite`

- `writeSite(out, …)` in `src/history/`, node-only. Its input is the latest Bundle, the Workspace name (none for `--bundle-only`), the index (none for `--bundle-only`), and the past Bundles to place, each copied from a cache file or given as a Bundle.
- It writes:
  - the latest Bundle;
  - `site.json` when there is a name;
  - `bundles/index.json`;
  - each past Bundle.
- It removes files in `bundles/` that are past Bundles and not kept (`src/history/index.ts:193-195`). A preview clears `bundles/` first, as today (`:259`).
- `publishHistory` (`:185-198`) and `publishPreview` (`:247-264`) compute their index and Bundles and call it. Their results (`PublishResult`, `PreviewMark`) are unchanged.
- `build` (wherever card 2's ticket 04 put it: `src/commands/`) calls `writeSite` for `site.json`, the latest Bundle, the history and the empty index outside git. Nothing else in `build` writes a site file. The viewer copy (`cp(VIEWER_DIR, out)`) stays in `build`.

### Other writers

- `src/cli/dev.ts:120, :138-141`: serve the module's text for the latest Bundle, `site.json` and an empty index. The empty index becomes pretty JSON with `schemaVersion: INDEX_VERSION`, as a built site has; it is served, not written.
- `website/src/lib/screenshots.ts:99` writes `site.json` with the module's text.
- `test/support/bundle-site.ts` and `test/mcp/history.test.ts:208-209` build their files with the module's paths and text.

## Docs

- None for behaviour.
- Check that the cache-header tables in `website/src/content/docs/docs/guides/publish/other-hosts.mdx:55-57` and `docs/publishing.md:175-178` list every file `writeSite` writes. Add `site.json` with `no-cache` to both, and to their S3 (`other-hosts.mdx:65-70`, `publishing.md:187-192`) and Netlify (`other-hosts.mdx:80-84`, `publishing.md:202-206`) snippets where `workspace.bundle.json` is named. Keep the two pages in step.
- Run `pnpm docs:test`.

## Tests

- `test/cli/build-site.test.ts`, `build-preview.test.ts`, `dev.test.ts`, `cli.test.ts` and `e2e/*.spec.ts` pass with their literal paths unchanged. `dev.test.ts:47` still reads `revisions: []`.
- `test/cli/build-site.test.ts:115-116` (cold vs. warm build, byte-identical) passes.
- New unit test for `writeSite` in a temp folder:
  - a stale past Bundle is removed and `index.json` is kept;
  - `--bundle-only` writes only the Bundle;
  - a preview clears `bundles/`.
- The website's screenshot hash (`siteHash`) is unchanged.
