# 05: `init` writes every stub

Status: ready-for-agent
Blocked by: 03, 04, 08
Spec: [Agent skills](../spec.md)

## What to build

PR title: `feat(init): ...`.

- `src/cli/init.ts`: write a stub per registered skill (`archidocs-<id>/SKILL.md`) into each of `SKILL_DIRS`, for both `init` and `init --skill`. Idempotent, as today.
- One AGENTS.md (and CLAUDE.md if present) pointer line per skill, inside the existing managed section.
- `--no-claude-skills` skips `.claude/skills/`. It doesn't touch `.mcp.json` (ADR 0002), which other harnesses read.
- `install-skill.mdx`: the four skills, what each fires on, the `--no-claude-skills` flag, and "pick the plugin or the repo stubs, one per repo".

## Tests

- `test/cli/init.test.ts`: four stubs per folder; pointer lines; `--no-claude-skills`; re-running changes nothing; an old single-skill install is upgraded in place.

## Acceptance criteria

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
