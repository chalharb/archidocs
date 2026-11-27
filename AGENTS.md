# Archidocs

## Agent skills

### Issue tracker

GitHub issues typed Epic → Feature → Task: a spec is a `Feature` issue and its tickets are `Task` sub-issues, tracked on the Archidocs Project (user project 8), through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Working an issue

Before working any issue, read its `Model` field on the Project and hand the work to a subagent or new session on that model; the session that was asked claims the issue and checks the result, but doesn't do the work. The steps are in `.claude/skills/work-issue/SKILL.md` (the `work-issue` skill in Claude Code); other harnesses follow the same file.

### Triage labels

The five default triage roles, recorded in the Project's `Status` field. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
