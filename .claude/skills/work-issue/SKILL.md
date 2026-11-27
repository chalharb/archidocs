---
name: work-issue
description: Use before starting work on any GitHub issue in this repo, such as "work #161", "implement issue 165", "pick up the next ticket" or "build the Docs launch epic". Reads the issue's Model field on the Archidocs Project and hands the work to a subagent or session running that model; the session that was asked never does the work itself.
---

# Work an issue on its recommended model

Every issue on the Archidocs Project has a `Model` field (`fable`, `opus`, `sonnet` or `haiku`): the tier its author recommends for the work. The session the user talks to is the **parent**. It reads the field, claims the issue, and hands the work to a **worker** on that model. It never does the work itself, even when its own model matches, so its context stays free for checking the result.

The tracker's ids and conventions are in `docs/agents/issue-tracker.md`. Read its "Working a ticket" section first.

## 1. Read the issue and its project fields

```bash
gh issue view <n> --comments
gh project item-list 8 --owner chalharb --format json --limit 200 \
  -q '.items[] | select(.content.number == <n>) | {status, priority, model}'
```

## 2. Check it can be worked

Stop and tell the user, without claiming it, when:

- `Status` is `backlog`, `needs-triage` or `needs-human`: it isn't ready for an agent.
- It's blocked by an open issue: `gh api repos/chalharb/archidocs/issues/<n>/dependencies/blocked_by -q '.[] | select(.state == "open") | .number'` prints anything.
- It's assigned to someone else, or `in-progress` with a claim comment from another session.
- Its type is `Request` or `Map`: a Request needs triage, and a Map is worked through `/wayfinder`.

## 3. Pick the model

Use the `Model` value. If it's empty, choose one from the option meanings in `issue-tracker.md`, set it on the issue, and tell the user which you chose and why before going on.

## 4. Claim it, in the parent

Assign it and set `Status` to `in-progress` (ids in `issue-tracker.md`), so no other session picks it up while the worker starts.

## 5. Hand it off

- **A subagent** (default): in Claude Code, call the `Agent` tool with `model` set to the field's value. `fable`, `opus`, `sonnet` and `haiku` are all valid values.
- **A new session**, when the user wants to follow or steer the work separately: start it on that model (`claude --model <value>`, or the app's session tool with its model setting).

Give the worker a self-contained brief:

- The issue number and URL, and an instruction to read the issue, its parent `Feature`'s spec, and `docs/agents/issue-tracker.md` "Working a ticket".
- The branch name: the issue number and a slug, such as `161-init-stubs`, branched from `beta`.
- What done means: the acceptance criteria met, the checks in `CONTRIBUTING.md` passing, and a PR into `beta` whose body follows `.github/pull_request_template.md` and starts `Closes #<n>`.
- Progress notes and questions go in issue comments; it doesn't change `Status`, `Model` or `Priority`.

A harness that can't choose a worker's model falls back to the parent doing the work, and its claim comment says which model did it and that the recommendation was `<model>`.

## 6. A Feature or an Epic

Don't hand a parent issue to one worker. Work its open sub-issues instead, each through steps 1–5 on its own `Model`. Run unblocked ones in parallel only when they touch different files; otherwise run them in blocking order, then by `Priority`, then by issue number.

## 7. Check the result

When the worker finishes, check its PR exists, targets `beta`, follows the PR template with `Closes #<n>`, and that CI is running. Set `Status` to `in-review`. Report the PR link to the user. Don't report the issue as done until the PR is merged.
