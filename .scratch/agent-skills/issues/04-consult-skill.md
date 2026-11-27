# 04: `consult` skill

Status: ready-for-agent
Blocked by: 01
Spec: [Agent skills](../spec.md)

## What to build

A read-only skill that fires while an agent changes code. PR title: `feat(guide): ...`.

- `guide/consult/SKILL.md`, frontmatter `name: archidocs-consult` and the description in the spec. Register `consult` (no topics).
- Sections, following the spec's `consult` decisions:
  - **Before the change**: the tool sequence, with `get_impact` at `max_depth: 1` plus one unlimited call for the "+N indirect" count. The four-line report template (consumers, Teams to tell, Deployments, ADRs), with an example.
  - **When to stop and ask**: an Accepted ADR contradicts the change; the change breaks a contract another Team's consumer uses. Otherwise carry on.
  - **After the change**: compare only the touched dependencies with the Element's Relationships; hand off to authoring's `relationships` / `add-service` topics; one line pointing at `fill-gaps` for drift beyond the change.
  - **Not in the Model**: one line, carry on, offer `add-service` or `bootstrap` afterwards.
  - **Answering questions**: the question → tool table.
  - **Without MCP**: read the YAML; the exact search for consumers (`to: <id>` within the Project, `to: <project>:<id>` across Projects, including `via`).
- Never writes. Writing goes through authoring.
- Website: a page beside `install-skill.mdx` on using consult while coding.

## Tests

- `get_guide("consult")` and `archidocs guide --skill consult` return it.
- The tool-name test from 01 covers it.

## Acceptance criteria

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
