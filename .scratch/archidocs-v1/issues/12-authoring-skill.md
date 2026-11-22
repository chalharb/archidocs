# Authoring skill

Type: grilling
Status: open
Blocked by: 03, 06, 08
Map: [Archidocs v1](../map.md)
Context: [View kinds and definitions](10-view-definitions.md) settles the YAML for Saved Views and Dynamic View Steps, and adds `upsert_view`/`remove_view` write tools. [ADR format and linking](11-adr-format.md) settles the propose flow: `propose_adr(project, title, elements?, views?, supersedes?, body?)` fills a Project or Workspace template (MADR minimal by default) when no body is given; accepting is a status edit in the PR. [archidocs check](16-archidocs-check.md) fixes the rule ids and their catalogue, served through `get_authoring_guide`; write tools refuse on errors, never warnings.

## Question

What does the authoring skill do, and how is it packaged? Settle: bootstrapping a Project's Model by reading its code (Services, Relationships, Deployments from config), the guided flows (add a Service, add a Dynamic View, propose an ADR), how it uses the MCP write tools, and how it ships in a harness-agnostic way.
