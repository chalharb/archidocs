# Issue tracker: GitHub issues and Projects

Work is tracked as GitHub issues in `chalharb/archidocs`, on the [Archidocs Project](https://github.com/users/chalharb/projects/8) (user project 8). Use the `gh` CLI.

The issue types follow Azure DevOps' Epic → Feature → Task, with sub-issues as the links:

| Type      | What it is                                                                                                   | Sub-issues        |
| --------- | ------------------------------------------------------------------------------------------------------------ | ----------------- |
| `Epic`    | A large outcome spanning several features.                                                                   | `Feature`s        |
| `Feature` | A decided feature. Its body is the **spec**: problem, solution, user stories, out of scope.                  | `Task`s           |
| `Task`    | One piece of build work, closed by one PR. What the skills call a **ticket**.                                | none              |
| `Bug`     | Something that doesn't work. A sub-issue of a `Feature` when it belongs to one.                              | none              |
| `Request` | An untriaged request or idea: what someone wants, not yet how. Triage turns it into a `Feature` or `Task`, or `wontfix`. | none |
| `Map`     | Wayfinding: the destination is known but the decisions aren't. Once its questions are answered, a `Feature` states the result. | questions (`Task`) |

User stories aren't issues: they're listed in the `Feature`'s spec, and each `Task` delivers a thin end-to-end slice of them.

Every issue's body follows its type's template in `.github/ISSUE_TEMPLATE/`, with the same headings in the same order: `epic.md`, `feature.md`, `task.md` and `map.md` (Markdown, for maintainers and agents), and the `bug_report.yml` and `feature_request.yml` forms (for users). The "Feature request" form makes a `Request`, not a `Feature`: it asks what the user is trying to do, what they'd like and what they do now, and lands in `backlog` for triage. Write the body to a file from the template, fill each section, and delete the HTML comments. A section with nothing to say stays, with "None." under it. Children are listed by GitHub as sub-issues, so a body never lists them.

When a skill says **spec** (or PRD), it means a `Feature` issue; **ticket** means a `Task` (or `Bug`).

- **Labels**: only `research`, `prototype` and `grilling` (a map question's kind), plus the contributor labels `good first issue`, `help wanted`, `question` and `accessibility`. The kind of issue is its type and where it stands is `Status`, never a label.
- **Blocking**: GitHub's issue dependencies ("blocked by"), not text in the body.
- **Board**: the Project's `Status` field holds the triage role or progress (see `triage-labels.md`). Every new issue starts in `backlog`. `Priority` (`P0`–`P2`) orders the work and `Model` recommends the model tier for it. To group by feature, group a view by the built-in `Parent issue` field.

Before 2026-11-27, specs and tickets were Markdown files under `.scratch/`, then briefly a Notion board. Open work and every spec moved to GitHub issues. Finished tickets and research notes weren't moved: they're in git at [`.scratch/` @ 2ada153](https://github.com/chalharb/archidocs/tree/2ada153/.scratch). Feature bodies still link there; a ticket's old number survives only in those links, and every live reference uses the issue number.

## Project ids

`gh project item-edit` needs ids, not names:

| What             | Id                               |
| ---------------- | -------------------------------- |
| Project          | `PVT_kwHOAFfac84BtfmB`           |
| `Status` field   | `PVTSSF_lAHOAFfac84BtfmBzhro1A0` |
| `Model` field    | `PVTSSF_lAHOAFfac84BtfmBzhro7Tk` |
| `Priority` field | `PVTSSF_lAHOAFfac84BtfmBzhro1VA` |

`Status` options: `backlog` `36c02995`, `needs-triage` `0c545800`, `ready-for-agent` `496af898`, `needs-human` `40466873`, `in-progress` `45445147`, `in-review` `98078e5a`, `done` `6d11c6fb`, `wontfix` `baa62b9e`.

`Priority` options: `P0` `79628723` (blocks a release or other work now), `P1` `0a877460` (next up), `P2` `da944a9c` (when there's time). An open `Feature` takes its most urgent open task's priority.

`Model` options: `fable` `c02e5f28` (strongest judgment: architecture, ambiguous specs, hard trade-offs), `opus` `52f568ac` (bugs with an unknown cause, performance, changes across modules), `sonnet` `96f1cf36` (well-specified features and refactors), `haiku` `ef7387b3` (mechanical edits: renames, copy changes, config).

An issue's project item id: `gh project item-list 8 --owner chalharb --format json -q '.items[] | select(.content.number == <n>) | .id'`.

## When a skill says "publish to the issue tracker"

- **A spec:** fill `.github/ISSUE_TEMPLATE/feature.md` into `spec.md`, then `gh issue create --title "Feature: <name>" --body-file spec.md`, then set its type to `Feature` (below). Add it to the project with `gh project item-add 8 --owner chalharb --url <issue url>`, and set `Model`, `Priority` and `Status` to `backlog`. If it belongs to an `Epic`, attach it as a sub-issue.
- **Tickets:** one issue per ticket, never one combined issue. Create each with `gh issue create --body-file`, its body filled from `task.md`, set its type to `Task`, attach it to its `Feature` as a sub-issue, add it to the project, and set `Model`, `Priority` and `Status`: `backlog`, unless the skill publishing it assigns a triage role, such as `ready-for-agent` for a ticket split from a finished spec. Create blockers first, then add the "blocked by" links.

Setting a type (an issue's `node_id` comes from `gh api repos/chalharb/archidocs/issues/<n> -q .node_id`):

```bash
gh api graphql -f query='mutation($i:ID!,$t:ID!){updateIssueIssueType(input:{issueId:$i,issueTypeId:$t}){issue{number}}}' -f i=<node_id> -f t=<type id>
```

Type ids: `Epic` `IT_kwDOAFfac844y7Z5`, `Feature` `IT_kwDOAFfac844yjMy`, `Task` `IT_kwDOAFfac84DGIHd`, `Bug` `IT_kwDOAFfac84DGIHe`, `Request` `IT_kwDOAFfac84DGIHf`, `Map` `IT_kwDOAFfac844y4Dr`.

Sub-issues and blockers take the issue's numeric `id` (`gh api repos/chalharb/archidocs/issues/<n> -q .id`), not its number:

```bash
gh api -X POST repos/chalharb/archidocs/issues/<feature>/sub_issues -F sub_issue_id=<task id>
gh api -X POST repos/chalharb/archidocs/issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker id>
```

## When a skill says "fetch the relevant ticket"

The user normally passes an issue number or URL: `gh issue view <n> --comments`. For a `Feature`'s tasks: `gh api repos/chalharb/archidocs/issues/<feature>/sub_issues`.

## Working a ticket

- **Model:** a ticket's `Model` is the tier its author recommends. The session asked to work an issue doesn't work it: it claims the issue and hands it to a subagent or new session on that model, as `.claude/skills/work-issue/SKILL.md` describes. Only a harness that can't choose a worker's model works it in place, and says so in its claim comment. Empty means no recommendation, and is worked on `sonnet`. `fable` is used only when the field says `fable`: never for an empty field, never by a worker inheriting the parent's model, and a parent on `fable` that can't choose a worker's model asks the user instead of working the ticket itself. An open `Feature`'s (or `Epic`'s) `Model` is the strongest among its open sub-issues, the tier an orchestrator needs to run them; a closed one has none.
- **Claim:** assign yourself or the user (`gh issue edit <n> --add-assignee @me`) and set `Status` to `in-progress` before any other work. An agent with no GitHub account of its own posts a comment saying which session claimed it.
- **Branch and PR:** put the issue number in the branch name (`161-init-stubs`). The PR body follows `.github/pull_request_template.md`, with the same headings, and its first line is `Closes #<n>`. `gh pr create --body-file` skips the template, so fill a copy of it.
- **Comments:** progress notes, manual-check results and questions go in issue comments.
- **Done:** merging the PR closes the issue, and the Project's workflow moves it to `done`. An unmerged PR means the ticket isn't done. A ticket that waits on the maintainer stays open, with a comment saying what's left.
- **Parent status:** a `Feature`'s, `Epic`'s or `Map`'s `Status` follows its sub-issues. It starts in `backlog`, moves to `in-progress` when any sub-issue is claimed or closed, and goes to `done` when its last sub-issue closes: close the parent issue then.

## Wayfinding operations

Used by `/wayfinder`. The **map** is an issue of type `Map`, and each **child** ticket is a sub-issue of it.

- **Map**: the issue body holds the Notes, Decisions-so-far and Fog sections. Edit it with `gh issue edit <n> --body-file`.
- **Child ticket**: a sub-issue whose `Type` is `Task`, with a label for its kind: `research`, `prototype` or `grilling`. The question goes in the body. Open means open, resolved means closed as completed.
- **Blocking**: "blocked by" dependencies. A ticket is unblocked when every issue blocking it is closed.
- **Frontier**: the map's open sub-issues with no assignee and no open blocker. Lowest issue number wins.
- **Claim**: assign it before any work. An open ticket with no assignee is unclaimed.
- **Resolve**: post the answer as a comment headed `## Answer`, and close the issue. Then add a context pointer (the gist and a link to the issue) to the map's Decisions-so-far.
