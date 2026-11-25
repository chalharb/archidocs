# Revision index and site layout: research

Status: done

Research for card 3 of the architecture review of 2026-11-24: "One Revision index, one owner of the published-site layout." It checks the card's claims against `origin/main` at `6b70992`, shows the divergences with a script, sketches an interface, lines this card up with card 2 ([Workspace checkout](../workspace-checkout/research.md), on branch `claude/workspace-checkout-research-fa4e89`), and lists risks and open questions. No source code was changed. Terms follow [GLOSSARY.md](../../GLOSSARY.md); "module", "interface", "seam", "adapter", "depth" and "leverage" are used as in the codebase-design vocabulary. There is no `docs/adr/` yet, so nothing here contradicts an ADR.

Spec and tickets: [spec.md](spec.md), [issues/](issues/).

**Verdict:** the card holds, with one correction. Turning a point into a Revision really is written three times and gives different answers for 9 of the 14 points tried below. But the card's first example, "where a date ends", makes no observable difference: commit dates have whole seconds, so `23:59:59Z` and `23:59:59.999Z` pick the same Revision, and git's `--before` is fed the same `23:59:59Z`. The real date divergence is elsewhere: git picks any first-parent commit, while the site and the viewer pick only Revisions. The site layout has no owner (6 write sites, 1 virtual server, 6 readers, 1 test fake), and the latest Bundle is never migrated. The refactor is worth a spec. One question needs grilling first: should a point on a checkout keep git's full ref grammar?

## Claims checked

| # | Claim | Holds? | Today |
|---|---|---|---|
| 1 | A point is turned into a Revision in three places | Yes | git: `resolvePoint` (`src/history/git.ts:132-138`); MCP site: `entryAt` (`src/mcp/history.ts:129-145`); viewer: `Timeline.find` (`viewer/src/revisions.ts:51-57`) |
| 2 | They give different answers | Yes | 9 of 14 points differ somewhere (table below) |
| 3a | A date ends in three different ways (`--before`, `23:59:59Z`, `23:59:59.999Z`) | Text yes, effect no | `git.ts:125`, `mcp/history.ts:45`, `revisions.ts:53`. Commit dates (`%cI`) have whole seconds, so all three pick the same Revision. Checked at the boundary: a commit at `23:59:59Z` is in, one at `00:00:00Z` the next day is out, in all three |
| 3b | Full ISO times: git and MCP accept them, the viewer doesn't | Yes | `isDate` (`git.ts:122`) takes `T`/space times with or without a zone; the viewer's test is `^\d{4}-\d{2}-\d{2}$` only (`revisions.ts:52`), so a time falls through to the sha-prefix test and finds nothing |
| 3c | Sha prefixes: git uses `rev-parse`, MCP takes hex only and reports ambiguity, the viewer takes any 4+ characters and picks the first match | Yes | `git.ts:137`; `mcp/history.ts:139-143`; `revisions.ts:56`. git's ambiguity comes back as "names no Revision", with no hint |
| 4 | Fetching, migrating and memoizing a past Bundle is written separately: the history cache, `mcp/history.ts:147-164`, `revisions.ts:99-112` | Yes | Cache: `bundleAt`/`readCached` (`history/index.ts:74-93`) rebuilds a Bundle of another `schemaVersion` instead of migrating it; MCP and viewer migrate with `migrateBundle` and memoize per sha with retry on failure. Same rules, written twice, plus a third variant |
| 5 | The index shape is `RevisionEntry`; the viewer keeps its own copy, `Revision` | Yes | `history/index.ts:21-31` and `viewer/src/revisions.ts:5-14`, field for field. `PreviewMark` is copied too (`history/index.ts:235-239`, `revisions.ts:17-21`) |
| 6 | Finding the Revisions that touch an Element is done twice: `scopeMatcher` and `ElementPanel:283` | Yes | `core/history-scope.ts:35-59` (used by MCP `list_history`, `mcp/server.ts:770`); `viewer/src/ElementPanel.tsx:283-292` walks `workspace.children` and calls `Timeline.touching` (`revisions.ts:70-72`). For an Element the two agree; the viewer has no Team or Project scope |
| 7 | The site layout has 5 writers, 1 virtual server, 6 readers and 1 test fake, and no owner | Yes (6 write sites in 4 files) | See "Who knows the site layout" |
| 8 | The latest Bundle isn't migrated the way past ones are | Yes | Viewer: `App.tsx:35` casts the JSON to `Bundle` with no parse or migration. MCP: `source.ts:140` runs `Bundle.safeParse` and refuses any other `schemaVersion`. Past Bundles go through `migrateBundle` (`mcp/history.ts:157`, `revisions.ts:105`). No effect yet: `SCHEMA_VERSION` is 1 and `migrations` is empty (`migrate.ts:11`) |

Not named by the card:

- **The index's `schemaVersion` is checked only by the checkout.** `readIndex` (`history/index.ts:95-103`) drops an index of another version. `bundlePast.index` (`mcp/history.ts:113-126`) and `loadTimeline` (`revisions.ts:80-89`) read `revisions` whatever the version says.
- **The checkout cache is a second copy of the same layout.** `.archidocs/cache/bundles/index.json` and `<sha>.json` (`history/index.ts:44-46`), which `publishHistory` copies from (`:195`).
- **The CLI resolves points too.** `archidocs diff` (`cli/main.ts:199-200`) and `history build --since` (`history/index.ts:160-166`) go through `resolvePoint`, so any change to how a checkout reads a date changes the CLI as well, and the docs that quote it (see "Documentation").
- **The docs already disagree with the code on the index re-check.** `docs/publishing.md:180` says MCP re-checks `index.json` with `If-None-Match` or `If-Modified-Since`. Only `workspace.bundle.json` gets conditional requests (`mcp/source.ts:80-82`). The index is fetched with `cache: "no-store"` and no validators (`mcp/history.ts:108`).
- **"Latest" is assumed to be `revisions[0]`.** `Timeline.isLatest` (`revisions.ts:65-67`) treats the newest Revision as what `workspace.bundle.json` shows. A site built from a branch other than the default branch, or from a commit that didn't change the Model, breaks that assumption. `build --preview` handles it on purpose (`history/index.ts:255-256`); a plain `build` doesn't.

## Evidence

### Divergences, by input

The script (kept outside the repo) builds a git repo with four commits, then publishes an index that lists the Revisions only, as `publishHistory` does:

- `c0` (2026-11-01 10:00Z) adds a README and isn't a Revision.
- `c1` (11-02 10:00Z) adds `ws/workspace.yaml`. It is a Revision, tagged `v1`.
- `c2` (11-03 09:00Z) changes docs only, tagged `docs-tag`. Not a Revision.
- `c3` (11-03 12:00Z) changes the Workspace. A Revision.
- Two more Revisions, `amb1` and `amb2`, have shas that share their first four characters.

It then runs each point through `resolvePoint`, `pastOf({ kind: "bundle" }).at` and `new Timeline(revisions).find`. Run with `TZ=America/Los_Angeles`.

| Point | git `resolvePoint` (checkout) | MCP `bundlePast.at` (site) | viewer `Timeline.find` |
|---|---|---|---|
| `2026-11-03` | c3 | c3 | c3 |
| `2026-11-01` (before the first Revision) | **c0** (built as an empty Model) | not_found | — |
| `2026-11-03T10:00:00Z` | **c2** (not a Revision) | c1 | **—** |
| `2026-11-03 10:00` (local time) | c3 | c3 | **—** |
| `2026-11-03T12:00:00+01:00` | **c2** | c1 | **—** |
| `v1` | c1 | c1 | c1 |
| `docs-tag` (a tag on a non-Revision) | **c2** | not_found | — |
| full sha of `c2` | **c2** | not_found | — |
| `c2` short sha | **c2** | not_found | — |
| `c3` short sha in upper case | c3 | c3 | c3 |
| `main` | **c3** | not_found | — |
| `HEAD~1` | **c2** | not_found | — |
| shared 4-character prefix | **— (not_found, no hint)** | not_found, "the start of 2 Revisions' shas", 2 suggestions | **amb2** (newest match, silently) |
| 7-character prefix of `amb1` | amb1 | amb1 | amb1 |

So the same question to MCP gets a different commit depending on whether MCP serves a checkout or the site published from it. Ask `get_changes from=2026-11-03T10:00:00Z`: a checkout answers from `c2`, the site from `c1`. The Model is the same at both, because `c2` changed no Workspace file, but the reported `commit` differs. On a checkout, a date before the first Revision gives an empty Model rather than `not_found`.

MCP's `time()` (`mcp/history.ts:82-89, :181-185`) answers a date without the index or git, but a ref through `resolvePoint` (checkout) or `entryAt` (site). So `list_history until=docs-tag` works on a checkout and is `not_found` on a site.

`sinceTime` (`history/index.ts:160-166`) is a fourth reading of a point, for `history build --since`. A bare date starts at `00:00:00Z`; anything else goes through `resolvePoint`.

### Where a date ends

| Where | Rule | Code |
|---|---|---|
| git | `rev-list -1 --first-parent --before=<date>T23:59:59Z <default branch>` | `git.ts:125, :134` |
| MCP | `Date.parse(<date>T23:59:59Z)`, compared `<=` | `mcp/history.ts:45, :134-135` |
| viewer | `Date.parse(<date>T23:59:59.999Z)`, compared `<=` | `revisions.ts:53-54` |

git's `--before` is inclusive and `%cI` has no fractional seconds, so the three agree on every index this code can write. The rule is still written three times, and a unified one should say "before the start of the next day" so the question can't come up. The card's sharper point stands: git's date is evaluated over all first-parent commits on the default branch, the other two over the Revisions only.

### Past Bundles: fetch, migrate, memoize

| | Checkout cache | MCP site | Viewer |
|---|---|---|---|
| Read | `readFile` of `.archidocs/cache/bundles/<sha>.json` (`history/index.ts:86`) | `readFile` or `fetch` of `bundles/<sha>.json` beside the Bundle (`mcp/history.ts:101-111, :153`) | `fetch("./bundles/<sha>.json")` (`revisions.ts:103`) |
| Old schema | Rebuilt from git and overwritten (`:90`) | `migrateBundle` (`:157`) | `migrateBundle` (`:105`) |
| `bundle: false` | n/a | `history_unavailable` (`:176`) | `HistoryUnavailable` (`:100`) |
| Memo | the file itself | `Map` per sha; failures dropped (`:147-163`) | `Map` per sha; failures dropped (`:96-112`) |
| Index re-check | n/a | every 60 s (`:94, :115`) | once per page load |

The MCP and viewer columns are one function with two fetchers.

### Who knows the site layout

`workspace.bundle.json`, `site.json`, `bundles/index.json`, `bundles/<sha>.json`:

| Role | Where | What |
|---|---|---|
| Writer | `cli/main.ts:98-100` | `site.json` |
| Writer | `cli/main.ts:103` | `workspace.bundle.json` |
| Writer | `cli/main.ts:277-280` (`writeSiteHistory`) | empty `bundles/index.json` outside git |
| Writer | `history/index.ts:184-197` (`publishHistory`) | `bundles/`, with retention |
| Writer | `history/index.ts:246-263` (`publishPreview`) | `bundles/` with a `preview` mark |
| Writer | `website/src/lib/screenshots.ts:99` | overwrites `site.json` |
| Virtual server | `cli/dev.ts:120, :138-141` | serves the Bundle, `site.json` and an empty index from memory |
| Reader | `viewer/src/App.tsx:31, :35` | `site.json`, `workspace.bundle.json` |
| Reader | `viewer/src/revisions.ts:82, :103` | index, past Bundles |
| Reader | `mcp/source.ts:64, :119-130` | `workspace.bundle.json` from a site root or folder |
| Reader | `mcp/history.ts:101-111, :118, :153` | index, past Bundles, as siblings of the Bundle |
| Reader | `website/scripts/tutorial.ts:33-36` | checks all three exist |
| Reader | `website/scripts/quick-start.ts:72` | `workspace.bundle.json` |
| Test fake | `test/support/bundle-site.ts` | serves `/site/workspace.bundle.json` plus a `files` map; `test/mcp/history.test.ts:208-209` hand-writes the `bundles/` paths into it |

The layout is also documented for hosts (`website/src/content/docs/docs/guides/publish/other-hosts.mdx:55-117`, with cache headers per file) and asserted literally by `test/cli/build-site.test.ts`, `build-preview.test.ts`, `dev.test.ts` and `e2e/{site,history,preview}.spec.ts`. Those literals are the published contract and should stay literal.

## Interface sketch

Names are placeholders for the spec.

### The Revision index module

A browser-safe folder, for example `src/revisions/` (no `node:` imports), so the viewer imports the same entry as MCP and the CLI. Its index is the only file imported from outside.

```ts
/** One Revision as the index records it. Moved from history/index.ts; the viewer's `Revision` goes. */
export interface RevisionEntry { sha; date; subject; author; tags: string[]; counts: ChangeCounts; changedIds: string[]; bundle: boolean }
export interface PreviewMark { base: string; baseSha: string; headSha: string }
export interface RevisionIndex { schemaVersion: number; revisions: RevisionEntry[]; preview?: PreviewMark }

/** The published site's paths: the one place they are spelled. */
export const site: { bundle: "workspace.bundle.json"; meta: "site.json"; index: "bundles/index.json"; past(sha: string): string };

/** A point, parsed once: a day, a time, or a ref-like string. The day's span is [start, next day's start). */
export type Point = { kind: "day"; start: number; end: number } | { kind: "time"; at: number } | { kind: "ref"; text: string };
export function parsePoint(text: string): Point;

/** A point against the index: tag, then hex sha or prefix (4+), then date. Ambiguity is a result, not a first match. */
export type Found = { ok: true; revision: RevisionEntry } | { ok: false; reason: "not_found" | "ambiguous"; suggestions: string[] };
export function find(index: RevisionIndex, point: string): Found;
export function timeOf(index: RevisionIndex, point: string, edge: "start" | "end"): { ok: true; time: number } | Found & { ok: false };

/** Scope matching (moved from core/history-scope.ts) and the Revisions that touch a scope. */
export function scopeMatcher(scope: HistoryScope, bundles: Bundle[]): (ids: string[]) => boolean;
export function touching(index: RevisionIndex, matches: (ids: string[]) => boolean): RevisionEntry[];

/** Any Bundle read from a file or a response, latest or past: migrated and parsed, or undefined. */
export function readBundle(raw: unknown): Bundle | undefined;
export function readIndex(raw: unknown): RevisionIndex | undefined;   // checks schemaVersion

/** A published site, read through one adapter; past Bundles memoized per sha, failures retried. */
export interface SiteReader { text(path: string): Promise<string | undefined> }   // undefined = 404
export function openSite(reader: SiteReader, options?: { recheckMs?: number }): {
  latest(): Promise<Bundle>;
  index(): Promise<RevisionIndex>;         // empty when the site has none
  bundle(revision: RevisionEntry): Promise<Bundle | Unavailable>;
};

/** What a site holds, as files: the one writer. Node adapters put them on disk; dev serves them. */
export function siteFiles(input: { latest: Bundle; name: string; index: RevisionIndex; past: Map<string, Bundle> }): Map<string, string>;
```

### Adapters

| Adapter | Where | Replaces |
|---|---|---|
| `fetchReader(base)`: relative `fetch` | viewer | `loadTimeline`, `loadBundle`, `App.tsx:31-35` |
| `fileOrHttpReader(location)`: `readFile` or `fetch` with ETag/Last-Modified | `src/mcp/` (node) | `bundlePast.read`; `bundleSource`'s fetch keeps its conditional requests and calls `readBundle` |
| `memoryReader(files)` | tests | `serveBundleSite`'s `files` map, for most cases |
| Git index (node) | `src/history/` | keeps `buildHistory`, `publishHistory`, `publishPreview` and the cache; they build a `RevisionIndex` and hand `siteFiles` the result |
| Site writer (node) | `src/history/` or card 2's `src/commands/build` | the `writeFile` calls at `main.ts:100, :103, :279`, `history/index.ts:196, :260-262`; `dev.ts:138-141` serves `siteFiles` from memory; `screenshots.ts:99` passes `name` instead of rewriting |

### The Past seam stays, and the viewer joins it

`Past` (`mcp/history.ts:21-28`) is already the right interface: `at`, `index`, `time`. After the change:

- `bundlePast` is `openSite(reader)` plus `find`/`timeOf`. Its private `entryAt`, `fetchBundle` and `read` go.
- `checkoutPast` builds the index with git (as now). How it resolves a point is the grilling question below.
- The viewer's `Timeline` keeps only what is about screens: `previewBase`, `compareLabel`, `previous`, `isLatest`. `find` calls the module's `find`. `TimeProblem` gains `ambiguous`, with suggestions to show.

### How a checkout resolves a point (needs a decision)

- **A. Index only.** The checkout builds the index, then calls `find` like everyone else. Every source gives the same Revision for the same point. Lost: `main`, `HEAD~1`, `origin/x`, tags on non-Revisions, shas off the default branch. Today `get_view at=<feature-branch sha>` works on a checkout.
- **B. git first, then snap to a Revision.** Refs go through `rev-parse`. A day or a time goes through `find` on the index, which drops `rev-list --before`. A commit that isn't a Revision is answered from its own Bundle, as now, but the result also names the Revision whose Model it shows. Sites and the viewer get the same `find`; the checkout accepts a superset. This covers `archidocs diff` and `history build --since` too, not only MCP. A checkout can then only date-resolve once its index is built, so `diff 2026-01-01` would first backfill `.archidocs/cache/` (or `find` would run over `firstParentCommitsTouching`, which needs no Bundles).
- **C. Keep git as it is.** Only the site and the viewer are unified.

Recommendation: **B**. Dates mean the same thing everywhere, which is the divergence users would notice. Refs keep working where only a checkout can answer them. An ambiguous prefix gets the same "give more of it" message, since `rev-parse`'s failure can be retried as a prefix search over the index.

## How the tests re-point

- **New `test/revisions/find.test.ts`**: the divergence table above as a pure table test over a hand-written index. No git, no server, runs in milliseconds. It covers the tag, the hex prefix, ambiguity, upper case, a day, a time with and without a zone, before the first Revision, and `bundle: false`.
- **`test/revisions/site.test.ts`**: `openSite(memoryReader)` covers the memo, retry after failure, migration of the latest and past Bundles, an index of another `schemaVersion`, and a site with no index. That is most of what `test/mcp/history.test.ts:219-275` ("history from a published Bundle site") does today over HTTP. Keep two of those over `serveBundleSite` for the HTTP path and the folder path.
- **`test/support/bundle-site.ts`** builds its `files` with `siteFiles`, so the fake can't drift from the layout. `test/mcp/history.test.ts:208-209` stops spelling `bundles/<sha>.json`.
- **`test/cli/build-site.test.ts`, `build-preview.test.ts`, `dev.test.ts` and `e2e/*.spec.ts` keep their literal paths.** They are the contract with hosts (`other-hosts.mdx`), and a test that imports `site.index` would pass even if the layout changed under users.
- **The viewer has no unit tests for `revisions.ts` today** (`test/viewer/` holds only `place.test.ts`). The module's tests cover it. `e2e/history.spec.ts` (Compare, a past Revision, the Element History tab) is unchanged and checks the viewer end to end.
- **Checkout**: `test/mcp/history.test.ts:30-92` ("`at` on a checkout") gains the cases for option B: a date names a Revision, and a ref to a non-Revision still answers.

## Risks

- **Behaviour changes users can see.** The viewer starts accepting full ISO times and stops picking the newest of several matching shas; a shared link with an ambiguous prefix now shows a problem instead of a Revision. A checkout's date answers change under option B (`c2` → `c1` above). Each needs a `fix(…)` ticket so release-please writes a changelog line.
- **Browser bundle size.** `scopeMatcher` moves into a browser-safe module the viewer already pulls `core` from; `readBundle` pulls the zod `Bundle` schema into the viewer, which today casts the latest Bundle without parsing it (`App.tsx:35`). Check the viewer bundle size before and after.
- **Parsing the latest Bundle in the viewer** makes a malformed `workspace.bundle.json` an error screen instead of a half-working viewer. That's probably right, but it is new.
- **`isLatest` vs. `workspace.bundle.json`.** Unifying makes it tempting to treat `revisions[0]` as the latest Bundle everywhere. That isn't true on a site built off the default branch. The module should not assume it; the viewer's screen logic can keep doing so.
- **MCP's 60 s re-check** of the index and Bundle must survive the move into `openSite` (`recheckMs`), with the conditional requests in `bundleSource` kept.
- **Cache vs. site migration rules differ on purpose.** The checkout can rebuild an old Bundle from git; a site can only migrate. `readBundle` is for sites. The cache keeps "rebuild, don't migrate" (`history/index.ts:70-72`), and the spec should say so, or someone will "unify" it.
- **Conflicts with card 2** in `src/mcp/history.ts`, `src/history/git.ts` and the empty-index writer. See below.

## Open questions

1. **How does a checkout resolve a point: A, B or C?** Grill this before the spec.
2. **What is the module called, and where does it live?** "Revision index" and "site" (the published site) aren't glossary terms, though docs and comments use both. Is `src/revisions/` right, or does it belong under `src/history/` split into browser-safe and node halves? Run `/domain-modeling`.
3. **Does `site.json` belong to this module?** It names the Workspace for exports and has nothing to do with Revisions, but it is part of the layout and has two writers.
4. **Does the index `schemaVersion` follow `SCHEMA_VERSION`?** Today both are the Bundle's version. An index whose shape never changed would be dropped by `readIndex` on every schema bump.
5. **Should `scopeMatcher` move,** or stay in `core/history-scope.ts` with the module re-exporting it? It is about Bundles as much as Revisions.
6. **Should a plain `build` off the default branch mark its index** (as `preview` does) so the viewer knows the latest Bundle isn't `revisions[0]`? It's a separate bug, maybe its own ticket.

## Documentation

The docs site is built from `website/`. Its generated reference comes from source: the CLI pages from `src/cli/commands.ts`, the MCP pages from the tool schemas in `src/mcp/server.ts` (through `website/src/reference/mcp.ts`), and the viewer URL page from `URL_PARAMETERS` in `viewer/src/place.ts` (through `website/src/reference/viewer-urls.ts`). `GLOSSARY.md` and `CHANGELOG.md` are published as pages too. As in card 2's spec, each ticket updates the docs it changes in the same PR. Paths below are under `website/src/content/docs/docs/` unless they start with `src/`, `viewer/`, `docs/` or `website/`.

| Ticket | Docs to update |
|---|---|
| 1 index shape | None. Internal move, no behaviour change. |
| 2 one `find` | **Viewer URL reference**: `at` and `vs` in `viewer/src/place.ts:56-57` say "A tag, commit sha or date". Make that "a tag, a commit sha or its first 4+ characters, or a date (`YYYY-MM-DD`) or time". **MCP reference**: the `at` description (`src/mcp/server.ts:887`) says "a date (YYYY-MM-DD…)", though times are accepted. Give the same grammar as the viewer, in one sentence the module exports, so the two references can't drift. Also the `not_found` row (`website/src/reference/mcp.ts:347`): name "a sha prefix that starts more than one Revision", with suggestions. **`guides/viewer/compare-two-revisions.mdx`** "If it didn't": a link whose `at` or `vs` is too short a sha now shows a problem naming the candidates, so say so. |
| 3 one site reader | **`help/upgrading.mdx:35`** says "Sites and caches rebuild the Workspace Bundle from git, so a new format needs no action". Add what reading means: the viewer and `mcp --bundle` read a site built by an older Archidocs by migrating its Bundles, latest and past, but not one built by a newer Archidocs. **`docs/publishing.md:180`** is wrong today (see "Not named by the card"). Either the reader adds conditional requests for the index, or the line says only the Bundle uses them. `guides/agents/connect-mcp.mdx:154` ("re-reads the site's Revision index at most once a minute") stays true. **`compare-two-revisions.mdx:46`** (`history_unavailable`) gains the third reason the viewer already has: a Bundle from a schema it can't read. |
| 4 one site writer | Output must be byte-identical, so the layout pages stay as they are: `guides/publish/other-hosts.mdx:55-117`, `docs/publishing.md:3, :175-223`, the "Bundles" section of `concepts/revisions-and-history.mdx`. The ticket checks that the cache-header table still lists every file the writer produces. `site.json` isn't in that table today; decide whether it belongs (`no-cache`, like `index.html`). |
| 5 checkout points | Under option B, every page that says a date is "the last default-branch commit" changes to "the last Revision": `concepts/revisions-and-history.mdx:35` and the "Only the default branch" bullet (`:52`), and `guides/review/diff.mdx:54`. The error string `cli/main.ts:200` ("a date resolves to the last default-branch commit at or before it") is quoted verbatim in `guides/review/diff.mdx:90` and `help/troubleshooting.mdx:45`; change all three together. The `diff` `<from>` description (`src/cli/commands.ts:232`) feeds the generated CLI reference. Say what happens to a date before the first Revision (`not_found`, not an empty Model). `concepts/agents-and-mcp.mdx:60` ("Same answers for people and agents") becomes true for points in time; no edit needed, but it is the line this ticket makes honest. |
| 6 Element history | None. The History tab (`compare-two-revisions.mdx:30`) behaves the same. |
| Any | If `/domain-modeling` makes **Revision index** a term (open question 2), add it to `GLOSSARY.md`. It must pass the wording rules (`pnpm docs:test`, `website/test/templates.test.ts`). Link its first use on `guides/agents/connect-mcp.mdx:154` and in `docs/publishing.md:3`, which already use the phrase. Each `fix(…)` ticket (2, 3, 5) gets its changelog line from release-please, which the Changelog page publishes. |

## Lined up with card 2 (Workspace checkout)

Card 2's spec is on `claude/workspace-checkout-research-fa4e89` (`.scratch/workspace-checkout/spec.md`, tickets 01-06). It already leaves the `bundles/` paths to this card (its "Card 3" section). The two specs split cleanly if both keep to this table:

| File / function | Card 2 | Card 3 |
|---|---|---|
| `src/git.ts` | becomes the one git runner (its ticket 02) | untouched |
| `src/history/git.ts` `resolvePoint`, `isDate` | stays, imports the runner | date half moves to `parsePoint`/`find`; `resolvePoint` keeps the ref half (option B) |
| `src/mcp/history.ts` `checkoutPast` (`:49-91`) | its repo lookup comes from the Checkout (ticket 03) | its `at`/`time` resolve through `find` (option B) |
| `src/mcp/history.ts` `bundlePast` (`:96-187`) | untouched | becomes `openSite` + `find` |
| `src/mcp/source.ts` `bundleSource`, `parse` (`:74-145`) | untouched (card 2 touches `checkoutSource` only) | `parse` calls `readBundle`; `BUNDLE_FILE` becomes `site.bundle` |
| empty index outside git (`main.ts:277-280`) | moved unchanged into `src/commands/` `build` (ticket 04) | replaced by `siteFiles` with an empty index |
| `site.json` / `workspace.bundle.json` writes (`main.ts:98-103`) | move into `build` (ticket 04) | written through `siteFiles` |
| `diff` point resolution (`main.ts:199-200`) | moves into `src/commands/` `diff` with its message unchanged (ticket 04) | under option B, resolves dates through `find`; the message and its two quoting docs pages change (ticket 5) |
| `cli/dev.ts:120, :138-141` | `rebuild` onto the Checkout (ticket 03); reload rule (ticket 06) | serves `siteFiles` |
| `website/src/lib/screenshots.ts:99` | the `build` call becomes in-process (ticket 05) | passes `name` instead of rewriting `site.json` |
| `history/index.ts` `publishHistory`/`publishPreview` | untouched | build a `RevisionIndex`; `siteFiles` writes it |

**Order:** card 3's tickets 1-3 below touch nothing card 2 does and can run in parallel with it. Ticket 4 (the site writer) should follow card 2's ticket 04, so there is one `build` to change, not `main.ts`. Ticket 5 (checkout points) should follow card 2's ticket 03, since both edit `checkoutPast`.

## Suggested ticket shape (if a spec follows)

1. **The index shape in one place.** A browser-safe `src/revisions/` with `RevisionEntry`, `RevisionIndex`, `PreviewMark` and the layout paths. The viewer's `Revision` and `PreviewMark` become imports. No behaviour change. (`refactor`)
2. **One `find` over the index.** `parsePoint`, `find` and `timeOf`, with the table tests. `bundlePast` and `Timeline.find` use them. The viewer takes full times and reports an ambiguous prefix. (`fix(viewer)`)
3. **One site reader.** `openSite` over a `SiteReader`, with fetch, file/HTTP and memory adapters. `readBundle` is used for the latest Bundle too (`App.tsx:35`, `source.ts:140`), and `readIndex` checks `schemaVersion` everywhere. (`fix(mcp)`, since the latest Bundle is now migrated)
4. **One site writer.** `siteFiles` feeds `build`, `publishHistory`, `publishPreview`, the empty index, `dev`'s virtual server and the test fake. `screenshots.ts` stops rewriting `site.json`. Byte-identical output on every existing test. After card 2's ticket 04. (`refactor`)
5. **Points on a checkout** (after grilling, and after card 2's tickets 03 and 04). Option B: dates through `find`, refs through `rev-parse`, with the Revision named, for MCP, `diff` and `history build --since`. (`fix(history)`)

Each ticket carries its rows of the "Documentation" table as acceptance criteria.
6. **The viewer's Element history through `scopeMatcher`.** `ElementPanel.tsx:283-292` and `Timeline.touching` give way to the module's `touching`. No behaviour change for Elements. (`refactor(viewer)`)
