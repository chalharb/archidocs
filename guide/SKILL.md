---
name: archidocs-authoring
description: Edit the Archidocs architecture Model. Use when bootstrapping a Project from code, adding or changing Services, Relationships, Deployments or Views, or proposing an ADR.
---

# Archidocs authoring

The Model is YAML in a Workspace: `workspace.yaml` defines Teams and Environments, and each Project folder (marked by `project.yaml`) declares its Elements, Relationships, Deployment Targets, Deployments and Saved Views. You need two things: code you can read, and a writable Workspace checkout served by `archidocs mcp --workspace <path>`.

Load the topic for the task before you write: `get_authoring_guide(topic)`, or `archidocs guide <topic>` without MCP.

## The Model

- **Elements**: Person, System, Service, Component. Nesting is strict: System › Service › Component; a Service may sit outside any System; Persons are top-level. Every Element has `name`, and optionally `description`, `owner`, `tags`, `links`.
  - Service adds `type` (`app` by default, `datastore`, `broker`), `technology`, `external`. System adds `external`. Component adds `technology`.
  - An External System or Service runs outside the organisation and has no declared Components.
- **Relationships** sit under their consumer and point `to` the provider it depends on. Edges between higher-level Elements are derived, never declared.
- **Ownership**: one Owner Team per Element, defaulting to the Project's `owner`. Set `owner` only when it differs.
- **Deployment Targets** nest to any depth, have a `kind`, and are not Elements. A **Deployment** is one Service in one Environment on one Target, and carries the `url` and `endpoints`. URLs live only on Deployments.
- **Ids** are lowercase slugs, unique per Project across Elements and Targets. Within a Project write bare ids; name another Project's Element as `project:id`. Teams and Environments are always bare.

## Edit loop

Every flow runs this loop:

1. **Read** with the read tools: `search_elements` to resolve names, URLs and hosts to `project:id`; `get_element`, `list_teams`, `list_environments`, `list_views`.
2. **Write** through the MCP write tools only: `create_project`, `upsert_element`, `upsert_relationship`, `upsert_target`, `upsert_deployment`, `upsert_team`, `upsert_environment`, `upsert_view`, `propose_adr`, and the `remove_*` tools. Each keeps comments and formatting and returns a unified diff. `dry_run: true` returns the diff and writes nothing.
3. **Refusal**: a write that would add a check error returns `validation_failed` with `issues` (file:line, rule, message); a removal still referenced returns its `references`. Fix the input or ask the user, then write again. The rule ids are explained in the `rules` topic. Resolve a refusal through the tools, so the Model stays valid at every step.
4. **Show** the user the returned diff after each single-change write.
5. **Finish** with `check`, then suggest a branch name, a PR title and a PR body. Leave committing to the user.

Without an MCP server, edit the YAML with your file tools and run `archidocs check` after each edit; the same rules apply.

## Asking the user

Code tells you what runs and what it calls. Ask the user for what code can't tell: the System grouping, External flags, business descriptions, and Owners other than the Project's.
