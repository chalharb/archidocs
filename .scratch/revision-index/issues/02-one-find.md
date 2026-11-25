# 02: One way to name a Revision

Status: ready-for-agent
Blocked by: 01
Spec: [Revision index](../spec.md)

## What to build

A point names the same Revision on a published site, over MCP, and in the viewer. PR title: `fix(history): ...`. List the behaviour changes below in the PR description; release-please turns the title into a changelog line.

### In the module

- `find(revisions, point)` over any newest-first list of `{ sha, date, tags }`. The order is exactly the one in the spec's "The point grammar":
  1. an exact tag;
  2. a day `[00:00Z, next 00:00Z)` or a full ISO 8601 time, read as UTC when it has no zone;
  3. hex of 4–64 characters, case-insensitive;
  4. otherwise `not_found`.

  It returns the Revision, or a failure:
  - `not_found`, with up to 5 suggested tags, and the first Revision when the point is a date before it;
  - `ambiguous`, with up to 5 full shas.
- A time span for a point, for MCP's `since`/`until`/`at` filters (`src/mcp/server.ts:755-763`):
  - a day spans from its start up to, but not including, the next day's start;
  - a time or a found Revision spans its one instant.

  Callers keep a Revision dated `>=` the start of `since` and `<` the end of `until`.
- One exported sentence describing the grammar, for the references: "a tag, a commit sha or its first 4 or more characters, or a date (`YYYY-MM-DD`) or time (ISO 8601, UTC unless it gives a zone)".

### Callers

- `src/mcp/history.ts` `bundlePast`:
  - `entryAt` (`:129-145`) and `dateTime` (`:44-47`) go; `at` and `time` call `find` and the span.
  - Keep the shortcut that answers the current commit without fetching (`:169-172`), but only for a full sha or a prefix that `find` doesn't report as ambiguous.
  - Messages: keep `"x" names no Revision: …` and `"x" is the start of N Revisions' shas; give more of it.`. For a date before the first Revision, add `The first Revision is <sha7>, <date>.`.
- `src/mcp/server.ts` `list_history` (`:752-763`): filter with the span instead of `<=`/`>=` on a single time.
- `checkoutPast.time` (`:82-89`) answers a date with the module's span too, so a day means the same on both sources. Its `at` is ticket 05's.
- Viewer:
  - `Timeline.find` (`viewer/src/revisions.ts:51-57`) calls `find`.
  - `TimeProblem` (`viewer/src/History.tsx:18`) gains `{ kind: "ambiguous"; point; candidates: Revision[] }`.
  - `resolveTimes` (`:22-28`) returns it.
  - `Unavailable` (`:74`) renders it like `unknown`: a heading, one sentence, each candidate as a link to the same place with that Revision's `pointLabel`, and "Back to latest".

### Behaviour changes (for the PR description)

- Viewer:
  - `at`/`vs` accept full times;
  - an ambiguous sha prefix shows the candidates instead of opening the newest;
  - a tag that looks like a date opens the tag.
- MCP on a site:
  - a time without a zone is UTC;
  - a tag that looks like a date wins;
  - `list_history until=<day>` keeps Revisions up to the end of the day, as before.
- MCP on a checkout: `time` for a date is unchanged in effect. (`23:59:59Z` and the exclusive end agree on whole-second dates.)

## Docs

- `viewer/src/place.ts:56-57`: `at` and `vs` take the grammar sentence as `values`. They feed the generated Viewer URLs reference (`website/src/reference/viewer-urls.ts`).
- `src/mcp/server.ts`: the `At` description (`:887`), the `Point` descriptions (`:676, :740-741`) and `get_changes`'s description (`:674`) use the grammar sentence. So does the intro in `website/src/reference/mcp.ts:240`. All of these feed the generated MCP reference.
- `website/src/reference/mcp.ts:347`: the `not_found` row adds "or a sha prefix that starts more than one Revision, with the candidates".
- `website/src/content/docs/docs/guides/viewer/compare-two-revisions.mdx`, "If it didn't": add a line saying a link whose `at` or `vs` is a short sha shared by several Revisions shows them to pick from.
- Run `pnpm docs:test`.

## Tests

- New `test/revisions/find.test.ts`, through the module's index only: the table in the spec's "Testing Decisions", run with `TZ` set to a non-UTC zone for the zone-less case. Start from the research's divergence table.
- `test/mcp/history.test.ts`: the site cases still pass. Add an ambiguous prefix, a zone-less time and a date before the first Revision.
- `e2e/history.spec.ts`: a link with an ambiguous `at` shows the candidates. Pick two Revisions of the e2e fixture with a shared prefix, or stub the index.
