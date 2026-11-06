# Autonomous agents

Five Claude agents run as GitHub Actions workflows and move work from requirements to a
merge-ready pull request. The repository owner is the only person who merges.

| Agent               | Workflow                             | Prompt                                     | Acts as        |
| ------------------- | ------------------------------------ | ------------------------------------------ | -------------- |
| Product Analyst     | `agent-product-analyst.yml`          | `.claude/agent-prompts/product-analyst.md` | `claude[bot]`  |
| Dev 1, Dev 2        | `agent-dev.yml` (one lane per label) | `.claude/agent-prompts/developer.md`       | dev GitHub App |
| Code Reviewer       | `agent-code-review.yml`              | `.claude/agent-prompts/code-reviewer.md`   | `claude[bot]`  |
| QA                  | `agent-qa.yml`                       | `.claude/agent-prompts/qa.md`              | `claude[bot]`  |
| Board sync (no LLM) | `agent-project-sync.yml`             | `.github/scripts/project-sync.mjs`         | `PROJECT_PAT`  |

The devs use their own GitHub App because GitHub does not let an account approve its own pull
request: `claude[bot]` can only approve PRs that someone else opened. Actions taken with the
default `GITHUB_TOKEN` do not start other workflows, so every hand-off between agents uses an
App token.

## Flow

```
Product Analyst ── creates type:feature / type:task issues (sub-issues, milestones)
   │  free lane → `agent:dev-N` then `status:ready`
   ▼
Developer (dev-N) ── `status:in-progress` → branch dev-N/<issue>-<slug> → pnpm check → PR
   │  PR body from the template, Conventional Commit title → `status:needs-review`
   ▼
Code Reviewer ── Next.js · web security · UI & accessibility (+ CLAUDE.md rules)
   │  approve → `status:needs-qa`        request changes → `status:changes-requested` ─┐
   ▼                                                                                    │
QA ── waits for CI, verifies every acceptance criterion of the linked issue             │
   │  pass → approve, `status:ready-to-merge`, assigns + requests review from owner     │
   │  fail → `status:qa-failed` ────────────────────────────────────────────────────────┤
   ▼                                                                                    │
Owner merges → issue closes → Product Analyst refills the lane       Developer (fix) ◄──┘
```

**Labels are the state machine.** The Project board is a view kept in step by
`agent-project-sync.yml` (Status, Agent and Size fields). Moving a card by hand does not start an
agent; change the label instead.

| Label                                            | On     | Meaning / who sets it                                                                                                             |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `type:feature`, `type:task`, `type:requirements` | issue  | Work structure (Product Analyst)                                                                                                  |
| `area:*`, `priority:p1..p3`, `size:xs/s/m`       | issue  | Grooming (Product Analyst)                                                                                                        |
| `agent:dev-1`, `agent:dev-2`                     | issue  | Lane assignment (Product Analyst)                                                                                                 |
| `status:ready` → `status:in-progress`            | issue  | Start signal → dev working                                                                                                        |
| `status:needs-review`                            | PR     | Dev → Code Reviewer                                                                                                               |
| `status:changes-requested`                       | PR     | Code Reviewer → Dev                                                                                                               |
| `status:needs-qa`                                | PR     | Code Reviewer → QA                                                                                                                |
| `status:qa-failed`                               | PR     | QA → Dev                                                                                                                          |
| `status:ready-to-merge`                          | PR     | QA → owner                                                                                                                        |
| `needs-human`                                    | either | All agents stop on this item until a person removes it                                                                            |
| `blocked`                                        | issue  | Waiting on another issue                                                                                                          |
| `update-visual-baselines`                        | PR     | Regenerates Linux screenshot baselines on CI and commits them (`visual-baselines.yml`); review the images, then push or re-run CI |

Work items: a **feature** issue groups **task** sub-issues; each task is the smallest piece that
can merge and deploy on its own (one PR, `size:m` ≈ 400 lines at most). Milestones are phases.
Later phases need an `Accepted` addendum before tasks are created, so for those the Product
Analyst opens a `type:requirements` PR with a `Proposed` addendum for the owner instead.

## Guardrails

- **WIP limit**: one item per dev lane; each lane's jobs run one at a time.
- **Review loops**: after `AGENT_MAX_REVIEW_ROUNDS` (default 3) rounds of requested changes the
  dev workflow labels the PR `needs-human` and stops.
- **Protected paths**: the Code Reviewer refuses PRs that touch `.github/`, `.claude/`,
  `CLAUDE.md` or `docs/Archidocs-prd.md` and labels them `needs-human`. The action also restores
  `.claude/` from the base branch on PR runs, so a PR cannot rewrite agent prompts.
- **Merging** needs the owner: no agent has merge rights and branch protection requires CI.
- **Conventional Commits**: `conventional-commits.yml` checks the PR title and every commit.
- **Cost**: every agent run has `--max-turns` and a job timeout.

## Setup

1. Repository secrets: `ANTHROPIC_API_KEY`, `DEV_APP_PRIVATE_KEY` (dev App `.pem`),
   `PROJECT_PAT` (classic PAT, scopes `repo` + `project`).
2. Repository variables: `DEV_APP_ID`, `DEV_APP_SLUG` (the App's URL name, e.g.
   `archidocs-dev`). Optional: `PROJECT_NUMBER` (default `2`), `PROJECT_OWNER` (default repo
   owner), `AGENT_MAX_REVIEW_ROUNDS` (default `3`), `AGENTS_PAUSED`.
3. Project fields (single select): Status = Backlog, Ready, In Progress, In Review, QA, Ready to
   Merge, Done; Agent = Dev 1, Dev 2; Size = XS, S, M.
4. Branch ruleset on `main`: PR required with 1 approval, required checks _Format, lint and
   types_, _Tests and coverage_, _Build and Playwright smoke_, _Conventional Commits_.
5. Actions → **Agents: setup check** → Run workflow. It creates the labels and fails with a
   table of anything missing from steps 1–3.
6. Actions → **Agent: Product Analyst** → Run workflow to seed the backlog. Look at the issues it
   creates before the devs get far; the first assignments start the dev agents immediately.

The agent workflows authenticate as `claude[bot]` through GitHub OIDC, which only works for
workflow files that match the default branch, so they start working once merged to `main`.

## Operating

- **Pause everything**: set the repository variable `AGENTS_PAUSED` to `true` (delete it or set
  `false` to resume). Running jobs finish; nothing new starts.
- **Stop one item**: add `needs-human`. To resume, remove it and re-add the last status label
  (e.g. `status:needs-review`), which re-triggers that stage.
- **Re-run a stage by hand**: each agent workflow has _Run workflow_ with an issue/PR input.
- **Steer the backlog**: run the Product Analyst with _instructions_, or edit/close issues;
  it re-reads the issue list every run.
- **Logs**: each run's summary shows the Claude transcript report.
