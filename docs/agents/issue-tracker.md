# Issue tracker: Code Factory

Issues (tasks) and specs for this repo live on the **Code Factory** kanban board, project
`archidocs` (key `AD`): https://code-factory.loganharber.com/projects/archidocs

Use the Code Factory MCP tools for all operations. The project ref can be `archidocs` or `AD`;
a task ref is its key, e.g. `AD-12`. Do not create GitHub issues.

## Board

Columns, in order: **Backlog → Todo → In Progress → In Review → Done**.

- New work lands in `Backlog`. `Todo` holds work that is ready to pick up.
- The board is linked to `chalharb/archidocs`. When a PR whose branch name or title contains the
  task key is opened, the card moves to `In Review`; when it merges, the card moves to `Done`.

## Conventions

- **Orient**: `get_board` (or `list_tasks` with `column`, `label`, `assignee`, `q` filters).
- **Create a task**: `create_task` with `project: "AD"`, a short imperative `title`, and a
  Markdown `description` holding the details and acceptance criteria. Defaults to `Backlog`.
- **Read a task**: `get_task` with the key. It returns the column, linked PRs and comments.
- **Comment on a task**: `add_comment`. Use it for progress notes, questions and answers.
- **Apply / remove labels**: `update_task` with `labels`. This **replaces** the whole label
  list, so read the task first and pass the existing labels plus or minus the change.
  Labels are stored lowercased.
- **Change title, description, priority, assignee**: `update_task` (only passed fields change).
- **Start work**: set `assignee` to your agent name, then `move_task` to `In Progress`.
- **Close**: `move_task` to `Done` (merging the linked PR does this automatically). To close
  without doing the work, add a comment explaining why, apply `wontfix`, and move to `Done`.
- **Parent / child**: there are no native sub-tasks. Put `Part of AD-<parent>` on the first
  line of the child's description and list the children in the parent's description.
- **Blocking**: put `Blocked by: AD-<n>, AD-<n>` on the first line of the description. A task
  is unblocked when every blocker is in `Done`.

## Branches and pull requests

The task key must appear in the branch name so the webhook links the PR, e.g.
`feat/ad-12-validate-command`. Put `AD-12` in the PR body too. PR titles stay Conventional
Commits (they become the squash commit). `link_pull_request` links a PR explicitly if the
webhook missed it.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature
requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a Code Factory task in project `AD` with `create_task`.

## When a skill says "fetch the relevant ticket"

`get_task` with its key (e.g. `AD-12`).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single task with **child** tasks as tickets.

- **Map**: a task labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body
  in its description.
- **Child ticket**: a task whose description starts with `Part of AD-<map>`; the map's
  description lists its children in order. Labels: `wayfinder:<type>`
  (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: a `Blocked by: AD-<n>, ...` line at the top of the child description.
- **Frontier query**: the map's children not in `Done`, minus any with a blocker not in
  `Done` or with an assignee; first in map order wins.
- **Claim**: `update_task` with `assignee`, then `move_task` to `In Progress`, as the
  session's first write.
- **Resolve**: `add_comment` with the answer, `move_task` to `Done`, then append a context
  pointer (gist + task key) to the map's Decisions-so-far.
