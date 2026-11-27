# Issue tracker: Notion

Specs and tickets for this repo live in Notion, not in the repo. Read and write them with the Notion MCP tools. If the Notion connector isn't available in your session, stop and tell the user. Don't fall back to Markdown files in the repo.

- **Board page:** [Archidocs Board](https://app.notion.com/p/42555a69dae480b9955fc251b5f39824)
- **Tickets data source:** `collection://42555a69-dae4-8000-8361-000b36d13c40`. Each ticket is one page in it. The page body holds the ticket text.
- **Specs data source:** `collection://42555a69-dae4-8168-93be-000b47cb385f`, the Specs database under the board page. One page per feature spec, wayfinding map or research note, with `Feature` and `Kind` (`spec`, `map` or `research`). Its `Tickets` relation is the inverse of each ticket's `Spec`.

Before 2026-11-27, specs and tickets were Markdown files under `.scratch/`. All of them were imported into Notion. Links inside the imported pages still point at the old files in git, at [`.scratch/` @ 2ada153](https://github.com/chalharb/archidocs/tree/2ada153/.scratch). Closed tickets imported then carry their old `Blocked by:` line as text, not as a relation.

## Ticket properties

| Property     | Type          | Meaning                                                                                    |
| ------------ | ------------- | ------------------------------------------------------------------------------------------ |
| `Name`       | title         | The ticket's title, without a number                                                      |
| `ID`         | unique id     | `ARC-<n>`, set by Notion. Use it to name a ticket in branches, PRs and messages            |
| `Status`     | status        | Triage role or progress (see `triage-labels.md`). The board's columns                      |
| `Feature`    | select        | The feature slug, e.g. `agent-skills`. Add an option for a new feature                     |
| `Number`     | number        | Order within the feature (the old `NN`)                                                    |
| `Type`       | select        | `task`, `bug`, `research`, `prototype` or `grilling`                                       |
| `Assignee`   | text          | Who claimed it: a person, or an agent's session name. Empty means unclaimed                |
| `Blocked by` | relation      | Tickets that must be done first. Its inverse is `Blocks`                                   |
| `Spec`       | relation      | The feature's page in the Specs database                                                   |
| `PR`         | URL           | The pull request that implements it                                                        |

## When a skill says "publish to the issue tracker"

- **A spec:** create a page in the Specs data source titled after the feature, with `Kind` `spec`. Add the feature slug as a `Feature` option in both data sources.
- **Tickets:** create one page per ticket in the tickets data source, never one combined page. Set `Feature`, `Number` (counting up from 1 within the feature), `Type`, `Status`, `Spec` and `Blocked by`. Create blockers first so the relation can point at them.

## When a skill says "fetch the relevant ticket"

The user normally passes an `ARC-<n>` id, a Notion URL, or a feature and number. Fetch the page, or query the data source by `ID`, or by `Feature` and `Number`.

## Working a ticket

- **Claim:** set `Assignee` to your name and `Status` to `in-progress` before any other work.
- **Branch and PR:** put the id in the branch name (`arc-12-add-login`). Set the ticket's `PR` property when you open the PR.
- **Comments:** add progress notes, manual-check results and questions as Notion comments on the ticket page.
- **Done:** when the PR merges, set `Status` to `Done`. An unmerged PR means the ticket isn't done. A ticket that waits on the maintainer keeps its status, with a comment saying what's left.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a page with one **child** ticket per question.

- **Map**: a page in the Specs data source with `Kind` `map`, titled `<effort> map`, holding the Notes, Decisions-so-far and Fog sections. Research findings are `Kind` `research` pages.
- **Child ticket**: a ticket with `Feature` set to the effort and `Type` set to `research`, `prototype`, `grilling` or `task`. The question goes in the body. Open means a to-do status, and resolved means `Done`.
- **Blocking**: the `Blocked by` relation. A ticket is unblocked when every ticket it lists is `Done`.
- **Frontier**: query the effort's tickets for a to-do status, no `Assignee`, and every `Blocked by` ticket `Done`. Lowest `Number` wins.
- **Claim**: set `Assignee` before any work. An open ticket with an empty `Assignee` is unclaimed.
- **Resolve**: append the answer under an `## Answer` heading in the ticket body, and set `Status` to `Done`. Then add a context pointer (the gist and a link to the ticket) to the map's Decisions-so-far.
