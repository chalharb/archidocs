# 06: Claude Code plugin

Status: ready-for-human
Blocked by: 05
Spec: [Agent skills](../spec.md)

## What to build

Ship the skills as the `archidocs` Claude Code plugin, so they show as `archidocs:authoring`, `archidocs:consult`, `archidocs:fill-gaps`, `archidocs:describe`. PR title: `feat(plugin): ...`.

- `.claude-plugin/marketplace.json` at the repo root, listing the `archidocs` plugin from `./plugin`.
- `plugin/.claude-plugin/plugin.json`: name `archidocs`, version, description, repository, license, `skills`.
- `plugin/skills/<id>/SKILL.md`: the stubs, frontmatter `name: <id>`, with the runner `npx archidocs`. Generated from `skillStub` by a script in `scripts/`.
- `plugin/.mcp.json`: `archidocs` running `npx archidocs mcp --workspace ${ARCHIDOCS_WORKSPACE:-.}`. First check Claude Code expands `${VAR:-default}` in a plugin's `.mcp.json`; if not, use `${ARCHIDOCS_WORKSPACE}` and document setting it.
- `release.config.mjs`: write the release version into `plugin.json` and `marketplace.json`, and add both to the git assets.
- Website install page: a "Claude Code plugin" section with the two `/plugin` commands, `ARCHIDOCS_WORKSPACE`, and the one-per-repo note (both the stubs and the MCP server appear twice if a repo has both).
- `package.json` `files` doesn't need `plugin/`: the marketplace reads it from GitHub.

## Tests

- The generated stubs match `skillStub` (fails on drift).
- `plugin.json` and `marketplace.json` versions equal `package.json`'s.
- Manual: `/plugin marketplace add` a local path, install, see the four skills under `archidocs:` and the MCP server connect.

## Acceptance criteria

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [ ] Manual install check recorded under `## Comments`.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
