# Bootstrap a Project from code

Declare an existing codebase's Services, Components, Relationships, Deployment Targets and Deployments in one pass. Bootstrap runs once; later changes go through the other topics.

## Steps

1. **Project.** Confirm the Project id, name and Owner Team with the user. If the Project is new, call `create_project(id, name, owner, folder?)` (folder defaults to `<id>/` under the Workspace root). Add a missing Team with `upsert_team` first.
2. **Inventory.** Read the code and build a table of candidates, each with its **evidence** (file:line) and a confidence (high, medium, low):
   - Services and datastores: Dockerfiles, compose files, Kubernetes manifests and Helm charts, Terraform, CI deploy steps.
   - Components: the modules inside one Service that the team talks about by name.
   - Outbound Relationships: HTTP clients and base URLs, gRPC stubs, OpenAPI clients, database connection strings, broker topics and queues (published and subscribed).
   - Deployment Targets (regions, clusters, namespaces, platforms) and Deployments with their URLs: env and config files per Environment, ingress hosts, CI deploy jobs.
   The inventory is complete when every deployable unit you found is a row or is listed as skipped with a reason.
3. **Questions.** Ask only what code can't tell: the System grouping, External flags, business descriptions, Owners other than the Project's.
4. **Approval.** Show the inventory; the user confirms or edits it. This one approval covers the writes, so write without `dry_run` from here.
5. **Write**, in dependency order: Systems, Services, Components (`upsert_element` with `parent`), Deployment Targets (`upsert_target`), Deployments (`upsert_deployment`), then Relationships (`upsert_relationship`). Environments must already exist in `workspace.yaml`; add one with `upsert_environment` after asking.
6. **Report.** Run `check`. Report what was written and what was skipped, each with its evidence, ready for the PR description.

## Cross-Project Relationships

- Declare only this Project's **outbound** Relationships; each provider declares its own.
- Resolve each provider with `search_elements` by name, URL or host to its `project:id`.
- No match: leave the Relationship out and list it in the report as a gap. Create Elements only in this Project.
- A provider clearly outside the organization (a payment provider, an email API) may be declared in this Project as an External Service owned by this Project's Team.

## Evidence

Evidence belongs in the report and the PR description. The Model holds only the architecture: no evidence fields, no `inferred` tags.
