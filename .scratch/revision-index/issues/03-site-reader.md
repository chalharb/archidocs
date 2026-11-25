# 03: One site reader

Status: ready-for-agent
Blocked by: 02
Spec: [Revision index](../spec.md)

## What to build

MCP and the viewer read a published site through one function, and the latest Bundle is migrated like past ones. PR title: `fix(history): ...`. List the behaviour changes in the PR description.

### In the module

- `readBundle(raw)`: `migrateBundle` (`src/history/migrate.ts:19`), which already parses. Move `migrate.ts` into `src/revisions/` and re-export it from `src/history/index.ts` for the cache's callers.
- `readIndex(raw)`: an index with `schemaVersion === INDEX_VERSION` and an array of `revisions`, keeping `preview` when its `baseSha` is a string (`viewer/src/revisions.ts:85`). Otherwise undefined.
- `SiteReader`: reads one path below the site root, with optional validators (ETag, Last-Modified). It answers with text plus validators, "not modified", or "missing" (a 404 or ENOENT). Other failures throw, carrying the location.
- `fetchReader(base)`: browser-safe, over `fetch` with `cache: "no-store"` and the validators as headers.
- `openSite(reader, { recheckMs, bundle? })`, where `bundle` is the latest Bundle's path below the root, `workspace.bundle.json` by default:
  - **latest**: the Bundle, re-checked at most every `recheckMs` with conditional requests. Throws with today's messages ("… is not JSON.", "… is not a Workspace Bundle this version can read.") when it can't be read.
  - **index**: the index, re-checked the same way. A missing index is "no history"; an unreadable one, or one of another version, is `history_unavailable` with today's messages (`src/mcp/history.ts:120, :123`).
  - **bundle(revision)**: the past Bundle, fetched once per sha, with failures dropped so they are retried. `bundle: false`, missing, unreadable and unmigratable each give `history_unavailable` with a reason and today's messages (`src/mcp/history.ts:155, :157, :176`).

### Adapters and callers

- `src/mcp/`: a node-only file-or-HTTP `SiteReader` built from `bundleSource`'s location rules (`src/mcp/source.ts:119-130`). A site root URL or folder is the root. A `.json` file's folder is the root, and its name is passed as `bundle`.
- `bundleSource` (`src/mcp/source.ts:74-117`) is `openSite(reader, { recheckMs: 60_000 })`.latest. It keeps its `location` getter, and `parse` (`:133-145`) goes.
- `bundlePast` (`src/mcp/history.ts:96-187`) uses the same `openSite` instance, reached through the source, so the Bundle and the index share one reader. `read`, `sibling`, `fetchBundle` and the index cache go.
- Viewer: `useSite` (`viewer/src/App.tsx:27-46`), `loadTimeline` and `loadBundle` (`viewer/src/revisions.ts:79-113`) become one `openSite(fetchReader("./"), { recheckMs: Infinity })`. `HistoryUnavailable` stays as the viewer's error type, carrying the module's reason. `site.json` is read through the module's path; it isn't part of `openSite`.
- Record the viewer's production bundle size (`pnpm build`, the size of `viewer/dist/assets/*.js`) before and after, in the PR description. If parsing the latest Bundle adds more than 30 kB gzipped, stop and ask: the fallback is to migrate without the zod parse.

### Behaviour changes (for the PR description)

- MCP `--bundle` on a site built by an older Archidocs migrates its latest Bundle instead of refusing it. (No effect until `SCHEMA_VERSION` goes up.)
- MCP re-checks `bundles/index.json` with `If-None-Match`/`If-Modified-Since` when the host gives validators, as it already does for the Bundle.
- An index of another version is `history_unavailable` in MCP and "no history" in the viewer, not read blindly.
- The viewer shows "Couldn't load the Workspace" for a malformed `workspace.bundle.json` instead of failing later.

## Docs

- `website/src/content/docs/docs/help/upgrading.mdx:35`: after "Sites and caches rebuild the Workspace Bundle from git", say that the viewer and `archidocs mcp --bundle` read a site built by an older Archidocs by migrating its Bundles, but not one built by a newer Archidocs. Rebuild the site, or use an `archidocs` at least as new.
- `docs/publishing.md:180`: now true. Check it reads correctly: both `index.json` and `workspace.bundle.json` are re-checked at most every 60 seconds, with conditional requests.
- `website/src/content/docs/docs/guides/agents/connect-mcp.mdx:154` ("re-reads the site's Revision index at most once a minute"): still true. Add "and the Bundle" if it reads better.
- `website/src/content/docs/docs/guides/viewer/compare-two-revisions.mdx:46` (`history_unavailable`): add that a Bundle from a format this viewer can't read gives it too.
- Run `pnpm docs:test`.

## Tests

- New `test/revisions/site.test.ts`, over an in-memory `SiteReader` in `test/support/` that records the validators each read sent. It covers:
  - memoizing; retry after a failed past Bundle;
  - `bundle: false`;
  - a missing index, an index of another version;
  - latest and past Bundles at an older schema, migrated by a test chain (see `test/history/migrate.test.ts`);
  - the re-check window;
  - a 304 for the index.

  `openSite` takes the chain as an option for tests only if `readBundle` can't be tested apart from it.
- `test/support/bundle-site.ts`: answers conditional requests for every file it serves, not only the Bundle.
- `test/mcp/history.test.ts` "history from a published Bundle site" (`:219-275`): keep the HTTP and folder cases. Delete those now covered by `site.test.ts`, and say which in the PR.
- `test/mcp/bundle-source.test.ts` passes unchanged: conditional requests, a missing source, a folder, a file.
- `e2e/history.spec.ts` and `e2e/site.spec.ts` pass unchanged.
