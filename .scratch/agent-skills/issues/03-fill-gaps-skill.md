# 03: `fill-gaps` skill

Status: done
Blocked by: 01, 02
Spec: [Agent skills](../spec.md)

## What to build

Move fill-gaps out of authoring into its own skill. PR title: `feat(guide): ...`.

- Move `guide/topics/fill-gaps.md` to `guide/fill-gaps/SKILL.md` with frontmatter `name: archidocs-fill-gaps` and the description in the spec. Register `fill-gaps` in the skill registry (no topics).
- Open the guide with: load `authoring` first (`get_guide("authoring")`, or `archidocs guide` without MCP); its edit loop and Model rules apply.
- Step 2 (Gap scan) calls `list_gaps` (or `archidocs gaps`) instead of building a Bundle and running jq. Delete the "Gap query" section. Keep "What counts as a gap" as the explanation of what `list_gaps` reports.
- The rest (interview, Evidence, Writing, Metadata, Decisions, Summary) moves unchanged.
- Remove `fill-gaps` from authoring's topic list and from the authoring description in `guide/SKILL.md` and the registry (spec, "Descriptions").
- `get_authoring_guide("fill-gaps")` / `archidocs guide fill-gaps` return the moved-topic note from the spec.
- Website: `website/src/content/docs/docs/guides/agents/fill-gaps.mdx` points at the skill and `archidocs gaps`.

## Tests

- `get_guide("fill-gaps")` returns the new guide; the moved-topic note; the authoring topic list no longer has `fill-gaps`.
- The tool-name test from 01 covers the new file.

## Acceptance criteria

- [ ] No jq in `guide/`.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
