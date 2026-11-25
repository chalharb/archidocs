# Revision index

Status: ready-for-agent

This spec gives the published site's layout and the Revision index one owner: one way to name a Revision, read a site and write one. It turns card 3 of the architecture review of 2026-11-24 into tickets, from the findings in [research.md](research.md). The research was checked against `6b70992`; line numbers here are from `origin/main` at `a5d1f97`, after card 2's git runner (PR #86). The decisions were settled in a grilling session on 2026-11-25 (Q1–Q18, listed under "Decisions"). Terms follow [GLOSSARY.md](../../GLOSSARY.md); "module", "interface", "seam", "adapter", "depth" and "leverage" are used as in the codebase-design vocabulary.

## Problem Statement

Three parts of Archidocs read history: MCP on a checkout, MCP on a published site, and the viewer. Each one writes its own rules for naming a Revision and for reading a site, so the same question gets different answers.

- **A point names different commits in different places.** Turning a point (a tag, a sha or a date) into a commit is written three times. On a checkout it goes through `resolvePoint` (`src/history/git.ts:118-124`), which `archidocs diff` (`src/cli/main.ts:199-200`) and `history build --since` (`src/history/index.ts:161-167`) also use. On a site, MCP uses `entryAt` (`src/mcp/history.ts:129-145`); the viewer uses `Timeline.find` (`viewer/src/revisions.ts:51-57`). The research ran 14 points through all three, and 9 gave different answers somewhere:
  - On a checkout, a date or time picks the last default-branch commit, even one that changed no Workspace file. On a site it picks the last Revision.
  - A date before the first Revision gives an empty Model on a checkout and `not_found` on a site.
  - The viewer rejects full times.
  - An ambiguous sha prefix gets "names no Revision" from git, a helpful ambiguity message from MCP, and the newest match, silently, from the viewer.
- **The index shape is copied.** `RevisionEntry` and `PreviewMark` (`src/history/index.ts:22-32, :236-240`) are repeated field for field as the viewer's `Revision` and `PreviewMark` (`viewer/src/revisions.ts:5-21`).
- **Reading a past Bundle is written twice.** Fetching, migrating and memoizing it is in `src/mcp/history.ts:147-164` and `viewer/src/revisions.ts:96-112`. Only the checkout cache checks the index's `schemaVersion` (`src/history/index.ts:96-104`).
- **The latest Bundle isn't migrated.** The viewer casts it unchecked (`viewer/src/App.tsx:35`). MCP refuses any other `schemaVersion` (`src/mcp/source.ts:140`). Past Bundles are migrated.
- **Nobody owns the site layout.** `workspace.bundle.json`, `site.json`, `bundles/index.json` and `bundles/<sha>.json` are known by:
  - 6 write sites: `main.ts:100, :103, :277-280`, `history/index.ts:185-198, :247-264` and `website/src/lib/screenshots.ts:99`;
  - a virtual server, `cli/dev.ts:120, :138-141`;
  - 6 readers;
  - a test fake that spells the paths by hand.
- **Finding the Revisions that touch an Element is written twice**: `scopeMatcher` in core, and `ElementPanel.tsx:283-292` with `Timeline.touching`.
- **The docs are wrong in one place.** `docs/publishing.md:180` says MCP re-checks the index with conditional requests. Only `workspace.bundle.json` gets them (`src/mcp/history.ts:108`).

## Solution

A browser-safe module, `src/revisions/`, owns the Revision index and the site layout. It holds:

- the index's shape and version;
- the site's paths;
- the point grammar and `find`;
- reading a site through one `SiteReader` adapter;
- the text of the files a site holds.

The viewer, MCP and the CLI all use it. The node side stays in `src/history/`: building the index from git, the checkout cache, and one `writeSite` that puts a site on disk. MCP's `Past` seam (`src/mcp/history.ts:21-28`) stays. Its site half is rebuilt on the module, and its checkout half resolves dates through the module. The viewer's `Timeline` keeps only screen logic.

## Implementation Decisions

### Packaging

- The folder is `src/revisions/`, with one index. Nothing outside imports another file in it.
- It is browser-safe: no `node:` imports. The viewer imports the same entry as MCP and the CLI.
- `src/history/` stays node-only. It keeps git, the checkout cache (`.archidocs/cache/`), `buildHistory`, `previewSides`, and the new `writeSite`.
- `scopeMatcher`, `resolveScope` and `filterChanges` stay in `src/core/history-scope.ts` (Q5).

### Interface

Exact names are settled in [ticket 01](issues/01-revision-index-module.md) and the tickets that extend it. The module holds:

- **The index shape**: `RevisionEntry`, `PreviewMark` and `RevisionIndex` (`{ schemaVersion, revisions, preview? }`), moved from `src/history/index.ts`. The viewer's copies go.
- **The index version**: `INDEX_VERSION = 1`, kept under the JSON key `schemaVersion` (Q4, Q15). It is independent of the Bundle's `SCHEMA_VERSION`; both are 1 today. A comment says so.
- **The site's paths**:
  - the latest Bundle, `workspace.bundle.json`;
  - the name file, `site.json`;
  - the index, `bundles/index.json`;
  - a past Bundle, `bundles/<sha>.json`;
  - a test for whether a file name is a past Bundle's.

  These are the only spellings outside tests (Q3).
- **The point grammar** (Q9, Q18):
  - `find(revisions, point)` over any list of `{ sha, date, tags }`, newest first, returning the Revision or a failure: `not_found` with suggested tags, or `ambiguous` with up to 5 candidate shas.
  - A time span for `since`/`until` filters.
  - One sentence describing the grammar, which the MCP and viewer references both use.
- **Reading**:
  - `readBundle(raw)`: migrate and parse, for the latest Bundle and past ones alike.
  - `readIndex(raw)`: checks `INDEX_VERSION` and the shape.
  - `openSite(reader, options)`: the latest Bundle, the index and past Bundles, re-checked and memoized (ticket 03).
- **Writing**: the text of the small files (the latest Bundle, `site.json`, the index), so every writer and `dev` produce the same bytes (ticket 04).
- **Touching**: the Revisions whose changed ids satisfy a matcher, newest first (ticket 06).

### The point grammar

`find` reads a point in this order (Q18):

1. **An exact tag.** The newest Revision carrying it.
2. **A date or a time.**
   - `YYYY-MM-DD` is the UTC day from that day's `00:00:00Z` up to, but not including, the next day's `00:00:00Z` (Q9). It names the last Revision dated within or before the day.
   - A full ISO 8601 time (`T` or a space, optional seconds and fraction) names the last Revision at or before it. A time with no zone is read as UTC, not local time (Q9).
3. **Hex of 4 to 64 characters**, case-insensitive: a sha or its prefix.
   - One match gives that Revision.
   - More than one gives `ambiguous`, with up to 5 full shas (Q6, Q14).
4. **Anything else, or nothing found**: `not_found`, suggesting up to 5 tags. A date before the first Revision is `not_found` too, and the failure carries the first Revision, so the message can name it (Q11).

Each caller writes its own message from the failure. MCP keeps today's text:
- `"x" names no Revision: …`
- `"x" is the start of N Revisions' shas; give more of it.`

It adds `The first Revision is <sha7>, <date>.` for a date before it. The viewer shows the candidates. The CLI's message is in ticket 05.

### Reading a site

- `SiteReader` reads one path below the site root. It may send validators (ETag, Last-Modified), and answers with text, "not modified" or "missing".
- Adapters:
  - A fetch adapter in the module, browser-safe. The viewer uses it with the page's own base; it also works in Node.
  - A file-or-HTTP adapter in `src/mcp/`, node-only. It takes a folder, a file or a URL, as `bundleSource` does today.
  - An in-memory adapter in `test/support/`, for tests.
- `openSite`:
  - Re-checks the latest Bundle and the index at most every `recheckMs` (MCP: 60 s; viewer: once per page load). It uses conditional requests for **both**, which makes `docs/publishing.md:180` true (Q8).
  - Fetches each past Bundle once and drops failures so they are retried.
  - Reports a dropped (`bundle: false`), missing, unreadable or unmigratable Bundle as `history_unavailable`, with a reason.
  - Treats a missing index as "no history", which the viewer shows as today and MCP reports as today.
- The latest Bundle goes through `readBundle`. The viewer parses and migrates it (Q7). MCP's `bundleSource` keeps its conditional requests and calls `readBundle` instead of `Bundle.safeParse`. A Bundle newer than this Archidocs, or one that is malformed, is still refused, with today's messages.
- The checkout cache keeps "rebuild, don't migrate" (`src/history/index.ts:71-73`). It has git, so it rebuilds; a site can only migrate. `readBundle` is for sites, and the cache's comment says why.

### Writing a site

- `writeSite(out, …)` in `src/history/` is the only code that writes a site to disk. It writes the latest Bundle, `site.json` (left out for `--bundle-only`) and the index. It also places each kept past Bundle, copied from the cache or serialized for a preview, and removes past Bundle files that are no longer kept. It takes the text of each file from the module.
- Its callers:
  - `build`, through card 2's commands;
  - `publishHistory` and `publishPreview`, which now compute an index and hand it over;
  - the empty index outside git.
- `dev` serves the module's text for the three small files from memory.
- `website/src/lib/screenshots.ts` writes `site.json` with the module's text.
- Output is byte-identical for every existing site test. `dev`'s empty index changes from compact JSON to the same pretty JSON a built site has. Nothing on disk changes.

### Points on a checkout

Refs still go to git; dates and times go through `find` (Q1, Q12, Q13, Q14). One function in `src/history/` replaces `resolvePoint`:

1. `git rev-parse --verify --quiet --end-of-options <point>^{commit}` (`src/history/git.ts:123`). Tags, branches, shas and `HEAD~1` resolve as today, and a non-Revision commit is answered as itself, with no new field (Q13). git's own order applies: a tag wins.
2. If git doesn't resolve it and it is a date or time: `find` over the default branch's Revision list, with tags. That list comes from `firstParentCommitsTouching` plus `tagsByCommit`, without building Bundles (Q12). A date before the first Revision is `not_found` (Q11).
3. If git doesn't resolve it and it is hex: a prefix search over the same list. One Revision gives that Revision; several give `ambiguous` (Q14).

`isDate`, `endOf` and the date branch of `resolvePoint` go. Its callers are:
- MCP's `checkoutPast.at` and `.time`;
- `diff` (`src/cli/main.ts:199-200`, or wherever card 2's tickets 01 and 04 have moved it);
- `history build --since`.

A ref's time is its commit date, as now.

### Viewer

- `Timeline` keeps `previewBase`, `compareLabel`, `previous` and `isLatest`. `find` calls the module. `touching` goes (ticket 06).
- `TimeProblem` (`viewer/src/History.tsx:18`) gains `ambiguous`, with the candidate Revisions. It renders like `unknown` (`History.tsx:76`) and lists each candidate as a link that opens it.
- `loadTimeline`, `loadBundle`, `HistoryUnavailable`'s source and `App.tsx:31-35` become one `openSite(fetchReader)`.

### Behaviour changes

Each is a `fix(…)` ticket, so release-please writes a changelog line.

- **Viewer**:
  - `at`/`vs` accept full times.
  - An ambiguous sha prefix shows the candidates instead of opening the newest.
  - A tag that looks like a date opens the tag.
  - The latest Bundle is parsed, so a malformed `workspace.bundle.json` gives the "Couldn't load the Workspace" screen. (Ticket 02, ticket 03.)
- **MCP on a site**:
  - A time without a zone is UTC.
  - A tag that looks like a date wins.
  - A latest Bundle from an older schema is migrated, not refused.
  - The index is re-checked with conditional requests.
  - An index of an unknown version is `history_unavailable`.

  (Tickets 02 and 03.)
- **Checkout (MCP, `diff`, `history build --since`)**:
  - A date or time names the last Revision, not the last default-branch commit.
  - A date before the first Revision is `not_found`, not an empty Model.
  - An ambiguous hex prefix is reported as ambiguous.
  - A time without a zone is UTC.

  (Ticket 05.)

### Decisions

From the grilling session on 2026-11-25:

| Q | Decision |
|---|---|
| 1 | Checkout: refs through git, dates through the index (option B) |
| 2 | Module at `src/revisions/`, browser-safe |
| 3 | The module owns the whole layout, `site.json` included |
| 4, 15 | The index has its own version, `INDEX_VERSION = 1`, under the key `schemaVersion` |
| 5 | `scopeMatcher` stays in core; the module offers `touching(revisions, matcher)` |
| 6, 14 | An ambiguous prefix is reported with candidates everywhere, the viewer and checkout included |
| 7 | The viewer parses and migrates the latest Bundle; check bundle size |
| 8 | Conditional requests for the index too, so `docs/publishing.md:180` becomes true |
| 9 | A day is `[00:00Z, next 00:00Z)`; a time without a zone is UTC |
| 10 | A plain `build` off the default branch is out of scope, filed separately |
| 11 | A date before the first Revision is `not_found` on a checkout too |
| 12 | A checkout's dates use the Revision list from git, without building Bundles |
| 13 | A non-Revision ref on a checkout is answered as itself, no new field |
| 16 | "Revision index" becomes a glossary term |
| 17 | Tickets 01–03 start now; 04 and 05 wait for card 2 |
| 18 | `find` order: tag, then date or time, then hex |

## Testing Decisions

- **New `test/revisions/find.test.ts`**: a pure table over a hand-written list, through the module's index only. It covers:
  - a tag, a tag that looks like a date, a day, a day before the first Revision;
  - a time with `Z`, with an offset, and with no zone (run under a non-UTC `TZ` to prove it's read as UTC);
  - a 4-character ambiguous prefix, a unique prefix, upper case;
  - a branch name, the empty string.

  The research's divergence table is the starting set.
- **New `test/revisions/site.test.ts`**: `openSite` over the in-memory reader. It covers:
  - memoizing and retry after a failure;
  - `bundle: false`;
  - a missing index, an index of another version;
  - a latest and a past Bundle at an older schema, using a test migration chain the way `test/history/migrate.test.ts` does;
  - the re-check window;
  - conditional requests, with the reader recording validators.
- **`test/mcp/history.test.ts`**:
  - "history from a published Bundle site" (`:219-275`) keeps two cases over `serveBundleSite`: HTTP and a folder on disk. The rest move to `site.test.ts`.
  - "`at` on a checkout" (`:30-92`) gains the cases for ticket 05: a date names a Revision, not a docs-only commit; a ref to a non-Revision still answers; a date before the first Revision; an ambiguous prefix.
- **`test/support/bundle-site.ts`** builds its files with the module's paths and text, so the fake can't drift from the layout. It also gains ETag handling for the index (ticket 03).
- **The literal paths in `test/cli/build-site.test.ts`, `build-preview.test.ts`, `dev.test.ts` and `e2e/*.spec.ts` stay literal.** They are the contract with hosts (`other-hosts.mdx`). A test that imported the constants would pass even if the layout changed under users.
- **`test/cli/history.test.ts`** (`diff`) gains a date that lands on a Revision, not on a later docs-only commit.
- **`e2e/history.spec.ts`** keeps Compare, a past Revision and the Element History tab. Ticket 02 adds one case: a link with an ambiguous `at` shows the candidates.
- Every existing site output is byte-identical, except `dev`'s empty index (ticket 04).

## Build Tickets

| # | Ticket | PR title | Blocked by |
|---|---|---|---|
| 01 | [The Revision index module](issues/01-revision-index-module.md) | `refactor(revisions)` | — |
| 02 | [One way to name a Revision](issues/02-one-find.md) | `fix(history)` | 01 |
| 03 | [One site reader](issues/03-site-reader.md) | `fix(history)` | 02 |
| 04 | [One site writer](issues/04-site-writer.md) | `refactor(history)` | 03; workspace-checkout 04 |
| 05 | [Points on a checkout](issues/05-checkout-points.md) | `fix(history)` | 02; workspace-checkout 03, 04 |
| 06 | [The viewer's Element history through `scopeMatcher`](issues/06-element-history.md) | `refactor(viewer)` | 03 |

02, 03 and 06 each edit `viewer/src/revisions.ts`, so they run one after another. 04 and 05 touch different files and can run in parallel once card 2's tickets land.

## Documentation

The docs site is built from `website/`. Its generated reference comes from source:
- the CLI pages from `src/cli/commands.ts`;
- the MCP pages from the tool schemas in `src/mcp/server.ts`, through `website/src/reference/mcp.ts`;
- the viewer URL page from `URL_PARAMETERS` in `viewer/src/place.ts`, through `website/src/reference/viewer-urls.ts`.

`GLOSSARY.md` and `CHANGELOG.md` publish as pages too. Each ticket updates what it changes in the same PR, and `pnpm docs:test` passes. Content paths are under `website/src/content/docs/docs/`.

| # | Docs |
|---|---|
| 01 | **Revision index** in `GLOSSARY.md`, under Distribution (Q16). Link its first use on `guides/agents/connect-mcp.mdx:154` to `/docs/reference/glossary/#term-revision-index`, and in `docs/publishing.md:3`. |
| 02 | The viewer URL reference: `at` and `vs` in `viewer/src/place.ts:56-57` take the module's grammar sentence. The MCP reference: the `at` description (`src/mcp/server.ts:887`), the `Point` descriptions (`:674, :676, :740-741`) and the intro (`website/src/reference/mcp.ts:240`) use the same sentence. The `not_found` row (`website/src/reference/mcp.ts:347`) names an ambiguous sha prefix. In `guides/viewer/compare-two-revisions.mdx`, "If it didn't" covers a link whose `at` or `vs` starts more than one Revision. |
| 03 | `help/upgrading.mdx:35`: the viewer and `mcp --bundle` read a site built by an older Archidocs by migrating its Bundles, but not one built by a newer one. `docs/publishing.md:180` and `guides/agents/connect-mcp.mdx:154`: the index and the Bundle are both re-checked with conditional requests. Check that the text matches what was built. `guides/viewer/compare-two-revisions.mdx:46`: `history_unavailable` also covers a Bundle from a schema this viewer can't read. |
| 04 | None, as output is byte-identical. Check that `guides/publish/other-hosts.mdx:55-117` and `docs/publishing.md:175-223` still list every file the writer produces. Add `site.json` with `no-cache` to both cache-header tables and to the S3 and Netlify snippets, since it is a site file that can change on a deploy. |
| 05 | Every "a date means the last default-branch commit" becomes "the last Revision": `concepts/revisions-and-history.mdx:35` and its "Only the default branch" bullet (`:52`), and `guides/review/diff.mdx:54`. The CLI's message changes with its two quotes, `guides/review/diff.mdx:90` and `help/troubleshooting.mdx:45`. The `diff` `<from>` description (`src/cli/commands.ts:232`) feeds the CLI reference. Say that a time without a zone is UTC, and that a date before the first Revision names nothing. |
| 06 | None. The History tab (`compare-two-revisions.mdx:30`) behaves the same. |

## Out of Scope

- **A plain `build` off the default branch** (Q10). Its `workspace.bundle.json` isn't `revisions[0]`, yet `Timeline.isLatest` treats it as the latest Revision. File it as a bug.
- **Opening a checkout**, the git runner and commands as functions: card 2, [Workspace checkout](../workspace-checkout/spec.md).
- **The cache's rebuild-not-migrate rule** stays as it is.
- **Team and Project scopes in the viewer's History tab.** The module makes them easy, but nobody has asked for them.
- **Changing the layout itself.** Paths, file names and cache headers stay as they are.

## Further Notes

Lined up with card 2 (Workspace checkout) so the two don't collide:

| Where | Card 2 | Card 3 |
|---|---|---|
| `src/mcp/history.ts` `checkoutPast` | repo from the Checkout (its 03) | `at`/`time` through the new resolver (05) |
| `src/mcp/history.ts` `bundlePast` | untouched | rebuilt on `openSite` and `find` (02, 03) |
| `src/mcp/source.ts` `bundleSource` | untouched (it changes `checkoutSource`) | `readBundle`, and the file-or-HTTP adapter (03) |
| `src/history/git.ts` | the runner moved out (done, PR #86) | `resolvePoint`'s date half goes (05) |
| `diff` and the empty index | moved into `src/commands/` unchanged (its 01, 04) | resolver (05); `writeSite` (04) |
| `src/cli/dev.ts` | `rebuild` onto the Checkout (03); reload rule (06) | serves the module's text (04) |
| `website/src/lib/screenshots.ts` | the `build` call in-process (05) | writes `site.json` with the module's text (04) |
