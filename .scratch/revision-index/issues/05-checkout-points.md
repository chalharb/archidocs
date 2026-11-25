# 05: Points on a checkout

Status: ready-for-agent
Blocked by: 02, workspace-checkout 03, workspace-checkout 04
Spec: [Revision index](../spec.md)

## What to build

On a checkout, a date or time names the last Revision, as it does on a site and in the viewer. Refs still go to git. PR title: `fix(history): ...`. List the behaviour changes in the PR description.

### The resolver

One function in `src/history/` replaces `resolvePoint` (`src/history/git.ts:118-124`). It takes the History and a point, and returns a commit sha or the module's failure (`not_found` with suggestions and, for a date, the first Revision; or `ambiguous` with shas). It tries:

1. `git rev-parse --verify --quiet --end-of-options <point>^{commit}`, as `resolvePoint` does at `:123`. A tag, branch, sha or `HEAD~1` resolves to its commit, Revision or not.
2. If that fails and the point is a date or time: `find` over the default branch's Revisions from `firstParentCommitsTouching(repoRoot, defaultBranch, workspacePath)`, with tags from `tagsByCommit`. No Bundle is built.
3. If that fails and the point is hex: a prefix search over the same Revisions, through `find`. One match gives that Revision; several give `ambiguous`.
4. Otherwise `not_found`, suggesting up to 5 tags.

`isDate` and `endOf` (`git.ts:108-111`) go. The module's grammar decides what a date or time is.

### Callers

- `src/mcp/history.ts` `checkoutPast` (as card 2's ticket 03 left it): `at` and `time` use the resolver. A ref's time is its commit date (`commitInfo`), as now. Messages are the same as `bundlePast`'s from ticket 02.
- `diff` (in `src/commands/`, after card 2's ticket 04): uses the resolver. Its message becomes `Unknown ref or date "x"; a date names the last Revision at or before it.`. For a date before the first Revision, it adds `The first Revision is <sha7>, <date>.`. For an ambiguous prefix: `"x" is the start of N Revisions' shas; give more of it.`. Keep the `archidocs: ` prefix and the usage exit code.
- `history build --since` (`sinceTime`, `src/history/index.ts:161-167`):
  - a day is its start;
  - a time is as given, UTC without a zone;
  - anything else goes through the resolver, and its commit date is used.

  `HistoryError`'s message follows `diff`'s.

### Behaviour changes (for the PR description)

On a checkout (MCP, `archidocs diff`, `history build --since`):
- A date or time names the last Revision, not the last default-branch commit. A docs-only commit after it is no longer picked.
- A date before the first Revision is `not_found` (MCP) or a usage error (`diff`), not an empty Model.
- An ambiguous hex prefix is reported with its candidates.
- A time without a zone is UTC, not the machine's local time.
- Refs, including branches, `HEAD~1` and shas off the default branch, are unchanged.

## Docs

- `website/src/content/docs/docs/concepts/revisions-and-history.mdx:35` ("A date means the last default-branch commit at or before it") becomes "the last Revision". Rewrite the "Only the default branch" bullet (`:52`) to match: a date picks the last Revision on the default branch.
- `website/src/content/docs/docs/guides/review/diff.mdx:54` becomes "the last Revision at or before that date". Add that a time without a zone is UTC.
- The new message is quoted verbatim in `guides/review/diff.mdx:90` and `help/troubleshooting.mdx:45`. Update both in the same PR.
- `src/cli/commands.ts:232` (`diff`'s `<from>`) feeds the generated CLI reference: "A git ref, or a date or time, which names the last Revision at or before it."
- `history build`'s `--since` (`src/cli/commands.ts:251-264`): the value becomes `<ref|date|time>`. The description adds "or this time (UTC unless it gives a zone)". The synopsis follows. All feed the generated `history build` reference.
- `concepts/agents-and-mcp.mdx:60` ("Same answers for people and agents") needs no edit; this ticket makes it hold for points in time.
- Run `pnpm docs:test`.

## Tests

- `test/mcp/history.test.ts` "`at` on a checkout" (`:30-92`): add
  - a date after a docs-only commit names the Revision before it, not the docs-only commit;
  - `HEAD~1` on a docs-only commit still answers;
  - a date before the first Revision is `not_found` and names the first Revision;
  - an ambiguous prefix (build two commits with a shared 4-character prefix, as the research script did).
- `test/cli/history.test.ts`: `diff <date>` lands on a Revision, and the new error messages.
- `website/test/` checks that pass the quoted error lines still pass.
- Unit test for the resolver with a temp repo: tag on a non-Revision commit, branch, full sha, a zone-less time under a non-UTC `TZ`.
