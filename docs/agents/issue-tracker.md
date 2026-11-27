# Issue tracker: GitHub issues and Projects

Specs and tickets are GitHub issues in `chalharb/archidocs`, tracked on the [Archidocs Project](https://github.com/users/chalharb/projects/8) (user project 8). Use the `gh` CLI.

- **Spec**: an issue of type `Spec`, holding the feature's spec in its body. A wayfinding map is also a `Spec` issue, with the `map` label.
- **Ticket**: an issue of type `Task` (or `Bug`, or `Feature` for an untriaged idea), added as a **sub-issue** of its spec.
- **Blocking**: GitHub's issue dependencies ("blocked by"), not text in the body.
- **Board**: the Project's `Status` field holds the triage role or progress (see `triage-labels.md`). `Feature` (single select) names the feature, `Number` orders tickets within it, and `Model` recommends the model tier for the work.

Before 2026-11-27, specs and tickets were Markdown files under `.scratch/`, then briefly a Notion board. Open work and every spec moved to GitHub issues. Finished tickets and research notes weren't moved: they're in git at [`.scratch/` @ 2ada153](https://github.com/chalharb/archidocs/tree/2ada153/.scratch). Spec bodies still link there.

## Project ids

`gh project item-edit` needs ids, not names:

| What             | Id                               |
| ---------------- | -------------------------------- |
| Project          | `PVT_kwHOAFfac84BtfmB`           |
| `Status` field   | `PVTSSF_lAHOAFfac84BtfmBzhro1A0` |
| `Feature` field  | `PVTSSF_lAHOAFfac84BtfmBzhro2OE` |
| `Number` field   | `PVTF_lAHOAFfac84BtfmBzhro2OI`   |
| `Model` field    | `PVTSSF_lAHOAFfac84BtfmBzhro7Tk` |

`Status` options: `needs-triage` `0c545800`, `needs-info` `dbada91e`, `ready-for-agent` `496af898`, `ready-for-human` `40466873`, `in-progress` `45445147`, `in-review` `98078e5a`, `done` `6d11c6fb`, `wontfix` `baa62b9e`.

`Model` options: `fable` `c02e5f28` (strongest judgment: architecture, ambiguous specs, hard trade-offs), `opus` `52f568ac` (bugs with an unknown cause, performance, changes across modules), `sonnet` `96f1cf36` (well-specified features and refactors), `haiku` `ef7387b3` (mechanical edits: renames, copy changes, config).

For `Feature` option ids, and for a new feature's option, run `gh project field-list 8 --owner chalharb --format json`.

An issue's project item id: `gh project item-list 8 --owner chalharb --format json -q '.items[] | select(.content.number == <n>) | .id'`.

## When a skill says "publish to the issue tracker"

- **A spec:** `gh issue create --title "Spec: <feature>" --body-file spec.md`, then set its type to `Spec` (below). Add it to the project with `gh project item-add 8 --owner chalharb --url <issue url>`, and set `Feature`. Add the feature as a `Feature` option first if it's new.
- **Tickets:** one issue per ticket, never one combined issue. Create each with `gh issue create`, set its type to `Task`, attach it to the spec as a sub-issue, add it to the project, and set `Status`, `Feature`, `Number` (counting up from 1 within the feature) and `Model`. Create blockers first, then add the "blocked by" links.

Setting a type (an issue's `node_id` comes from `gh api repos/chalharb/archidocs/issues/<n> -q .node_id`):

```bash
gh api graphql -f query='mutation($i:ID!,$t:ID!){updateIssueIssueType(input:{issueId:$i,issueTypeId:$t}){issue{number}}}' -f i=<node_id> -f t=<type id>
```

Type ids: `Spec` `IT_kwDOAFfac844yjMy`, `Task` `IT_kwDOAFfac84DGIHd`, `Bug` `IT_kwDOAFfac84DGIHe`, `Feature` `IT_kwDOAFfac84DGIHf`.

Sub-issues and blockers take the issue's numeric `id` (`gh api repos/chalharb/archidocs/issues/<n> -q .id`), not its number:

```bash
gh api -X POST repos/chalharb/archidocs/issues/<spec>/sub_issues -F sub_issue_id=<ticket id>
gh api -X POST repos/chalharb/archidocs/issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker id>
```

## When a skill says "fetch the relevant ticket"

The user normally passes an issue number or URL: `gh issue view <n> --comments`. For a spec's tickets: `gh api repos/chalharb/archidocs/issues/<spec>/sub_issues`.

## Working a ticket

- **Model:** a ticket's `Model` is the tier its author recommends. An orchestrating agent spawns the worker on that model; one working the ticket itself on a weaker model says so in its claim comment. Empty means no recommendation.
- **Claim:** assign yourself or the user (`gh issue edit <n> --add-assignee @me`) and set `Status` to `in-progress` before any other work. An agent with no GitHub account of its own posts a comment saying which session claimed it.
- **Branch and PR:** put the issue number in the branch name (`161-init-stubs`). The PR body says `Closes #<n>`.
- **Comments:** progress notes, manual-check results and questions go in issue comments.
- **Done:** merging the PR closes the issue, and the Project's workflow moves it to `done`. An unmerged PR means the ticket isn't done. A ticket that waits on the maintainer stays open, with a comment saying what's left.
- **Spec done:** close the spec issue when its last sub-issue closes.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a `Spec` issue with the `map` label, and each **child** ticket is a sub-issue of it.

- **Map**: the issue body holds the Notes, Decisions-so-far and Fog sections. Edit it with `gh issue edit <n> --body-file`.
- **Child ticket**: a sub-issue whose `Type` is `Task`, with a label for its kind: `research`, `prototype` or `grilling`. The question goes in the body. Open means open, resolved means closed as completed.
- **Blocking**: "blocked by" dependencies. A ticket is unblocked when every issue blocking it is closed.
- **Frontier**: the map's open sub-issues with no assignee and no open blocker. Lowest `Number` wins.
- **Claim**: assign it before any work. An open ticket with no assignee is unclaimed.
- **Resolve**: post the answer as a comment headed `## Answer`, and close the issue. Then add a context pointer (the gist and a link to the issue) to the map's Decisions-so-far.
