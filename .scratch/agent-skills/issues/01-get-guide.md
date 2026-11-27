# 01: `get_guide` and `--skill`

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Agent skills](../spec.md)

## What to build

One way to load any skill's guide. PR title: `feat(guide): ...`.

- `src/guide/index.ts`: a skill registry `{ id, name, description, dir, topics? }` for `authoring` (today's `guide/SKILL.md` and `guide/topics/`). Later tickets add `consult`, `fill-gaps` and `describe` with `guide/<id>/SKILL.md`. Export `guide(skill, topic?)` returning the existing `GuideResult`; keep `authoringGuide(topic)` as `guide("authoring", topic)`.
- A topic on a skill with no topics is refused, naming the skill. An unknown skill or topic gets a `suggest()` suggestion, as unknown topics do today.
- MCP (`src/mcp/server.ts:837`): register `get_guide(skill, topic?)`. Keep `get_authoring_guide`, its description saying it's deprecated in favour of `get_guide`.
- CLI (`src/cli/commands.ts:109`): `archidocs guide [topic] [--skill <id>]`, `--skill` defaulting to `authoring`. Update the synopsis, options and examples.
- `skillStub(runner)` becomes `skillStub(skill, runner)`, using the registry's `name` (`archidocs-<id>`) and `description`, and telling the agent to call `get_guide("<id>")` or run `<runner> guide --skill <id>`. Authoring's stub keeps calling out `get_authoring_guide` as a fallback for servers older than this release.

## Tests

- `test/mcp/guide.test.ts`, `test/cli/guide.test.ts`: `get_guide("authoring")` equals `get_authoring_guide()`; each topic; unknown skill and topic suggestions; `--skill` defaulting.
- A test that every backticked `snake_case` name in `guide/**/*.md` that looks like a tool is registered on the MCP server.

## Acceptance criteria

- [ ] `get_guide` and `archidocs guide --skill` serve authoring and its topics.
- [ ] `get_authoring_guide` and `archidocs guide <topic>` behave as before.
- [ ] The tool-name test passes.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
