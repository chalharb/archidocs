# 08: `describe` skill

Status: ready-for-agent
Blocked by: 01, 07
Spec: [Agent skills](../spec.md)

## What to build

Build the Model from the user's prose, round by round. PR title: `feat(guide): ...`.

- `guide/describe/SKILL.md`, frontmatter `name: archidocs-describe` and the description in the spec. Register `describe` (no topics). Opens by loading authoring.
- Sections, following the spec's `describe` decisions:
  - **Input**: only what the user says; never reads code.
  - **First round**: Project and Owner Team, once.
  - **Each round**: map prose to Elements, Relationships, Deployment Targets and Deployments; play back the whole draft as an outline plus one-line-per-path flow; ask only the ambiguities as numbered questions with proposed answers.
  - **Mapping cues**: a BFF (Component of the web Service, or its own Service: ask), a managed datastore (`type: datastore`, ask whether `external`), a platform (Deployment Target `kind`), an ETL or job (a Service), a black box (vendor → `external: true`; in-house → System with no Components), a gateway (per ADR 0005).
  - **Writing**: nothing until the first draft is approved; then write, and write each round's changes after. Start `archidocs dev` in the background if possible, else print the command.
  - **Never invent** Environments, URLs or Owners; a named platform triggers one question about Environments.
  - **Cross-Project**: propose a separate Project for another Team's System; accept "keep it all in one".
  - **Finish**: authoring's edit-loop finish, then offer `fill-gaps`.
  - **Worked example**: "I have a next.js app that uses BFF to call an api that's running on anthos and is proxied through an apigee gateway. That API gets its data from BigQuery. The bigquery table is populated by an ETL from a black-boxed service", with its first-round draft, flow and questions.
- Website: a page beside `install-skill.mdx` on describing an architecture.

## Tests

- `get_guide("describe")` and `archidocs guide --skill describe` return it.
- The tool-name test from 01 covers it.

## Acceptance criteria

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
