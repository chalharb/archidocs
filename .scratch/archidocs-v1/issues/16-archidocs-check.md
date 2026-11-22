# archidocs check

Type: grilling
Status: open
Blocked by: 07
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) reuses this ticket's `{file, line, rule, message}` issue records in MCP errors and the `check` tool.

## Question

What exactly does `archidocs check` validate and report? It runs once over the whole Workspace repo ([Workspace aggregation](07-workspace-aggregation.md)). Settle: the full list of rules, starting from [Authoring format](06-authoring-format.md)'s prototype list plus the Workspace rules (nested `project.yaml`, model files outside a Project, duplicate Project ids, Teams or Environments outside `workspace.yaml`, unknown `project:id` references); which are errors and which are warnings; the output format (human and machine-readable, for CI annotations and MCP write tools); and exit codes.
