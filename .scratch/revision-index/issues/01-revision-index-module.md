# 01: The Revision index module

Status: ready-for-agent
Spec: [Revision index](../spec.md)

## What to build

Create the module and move the index shape and the site's paths into it. This ticket changes no behaviour. PR title: `refactor(revisions): ...`.

### The module

- Create `src/revisions/` with one index. Nothing outside imports another file in it. It is browser-safe: no `node:` imports. Add an ESLint `no-restricted-imports` rule for `node:*` under `src/revisions/` if the config makes that easy; otherwise a test that greps the folder.
- Move `RevisionEntry`, `RevisionIndex` and `PreviewMark` from `src/history/index.ts:22-37, :236-240` into it. Add `preview?: PreviewMark` to `RevisionIndex`, since `publishPreview` writes it (`:263`).
- Add `INDEX_VERSION = 1`. Its comment says it is the index's own version, written under the JSON key `schemaVersion`, and independent of the Bundle's `SCHEMA_VERSION`, though both are 1 today.
- Add the site's paths: the latest Bundle (`workspace.bundle.json`), the name file (`site.json`), the index (`bundles/index.json`), a past Bundle (`bundles/<sha>.json`), and a test for whether a file name in `bundles/` is a past Bundle's. That test is the regex now at `src/history/index.ts:194`.

### Callers

- `src/history/index.ts`:
  - imports the types and re-exports nothing it moved;
  - stamps the cache index (`:156`) and the published index (`:197`, `:263`) with `INDEX_VERSION`;
  - `readIndex` (`:96-104`) checks `INDEX_VERSION`;
  - uses the module's past-Bundle test at `:194`.
- `src/mcp/history.ts`, `src/mcp/server.ts`: import `RevisionEntry` from the module.
- `viewer/src/revisions.ts`: delete `Revision` and `PreviewMark`. Import `RevisionEntry` and `PreviewMark` from the module. Keep the name `Revision` as a type alias in the viewer only if renaming touches more than a handful of files; say which in the PR.
- The string literals in `src/cli/main.ts:100, :103, :278-279`, `src/cli/dev.ts:138-141`, `src/mcp/source.ts:64`, `src/mcp/history.ts:118, :153` and `viewer/src/App.tsx:31, :35`, `viewer/src/revisions.ts:82, :103` use the module's paths. If card 2 has moved `main.ts` code into `run.ts` or `src/commands/`, follow it there.

## Docs

- Add **Revision index** to `GLOSSARY.md` under Distribution, after Revision: *"The list of a Workspace's Revisions, newest first, each with its commit, tags and Change counts, that a published site and a checkout's cache keep beside the past Workspace Bundles."* Add an `_Avoid_` line, such as "history file, manifest". It must pass the wording rules (`pnpm docs:test`, `website/test/templates.test.ts`).
- Link the first "Revision index" on `website/src/content/docs/docs/guides/agents/connect-mcp.mdx:154` to `/docs/reference/glossary/#term-revision-index`. Check the anchor the Glossary page generates.
- `docs/publishing.md:3` already says "the Revision index"; no change.

## Tests

- All existing tests pass unchanged. Site output, the cache and the viewer are byte-identical.
- A test that `src/revisions/` imports nothing from `node:`.
