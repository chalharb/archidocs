# 27: Authoring guide, skill and init

Status: done
Assignee: Logan Harber (Claude)
Blocked by: 10, 19, 21
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Any agent harness knows how to author the Model.

- `get_authoring_guide(topic?)`: returns `SKILL.md` and the list of topics, or one topic's reference file. `archidocs guide [topic]` prints the same.
- Topics: `bootstrap`, `add-service`, `relationships`, `deployments`, `dynamic-view`, `saved-view`, `propose-adr`, `change`.
- The rule catalogue from 02 is included in the guide.
- `archidocs init` (Workspace) and `archidocs init --skill` (code repo) write a thin stub to `.agents/skills/`, `.claude/skills/` and `.github/skills/`, add pointers to AGENTS.md (and CLAUDE.md if present), and print the MCP command.
- `archidocs mcp --workspace <path>`.

## Acceptance criteria

- [x] MCP and CLI tests show the guide text matches across both and lists every topic.
- [x] `init` writes the expected files into an empty temp repo and is safe to re-run.
- [x] `mcp --workspace` from a separate folder serves and edits the fixture Workspace.
