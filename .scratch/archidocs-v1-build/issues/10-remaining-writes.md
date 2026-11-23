# 10: Remaining write tools

Status: done
Assignee: Claude (ticket-10 session)
Blocked by: 05, 09
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Agents can author everything else through MCP.

- `upsert_target` and `remove_target`.
- `upsert_deployment` and `remove_deployment`, identified by their triple.
- `upsert_team` and `upsert_environment`, which write `workspace.yaml`.
- `create_project(id, name, owner, folder?)`: writes `project.yaml` (default folder `<workspace-root>/<id>/`) and refuses duplicate ids and nesting inside another Project.
- All follow the write rules from 09.

## Acceptance criteria

- [x] Each tool round-trips through the fixture and keeps comments.
- [x] Removing a Target still used by a Deployment is refused, with the reference.
- [x] `create_project` inside an existing Project is refused.
