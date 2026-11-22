# ADR format and linking

Type: grilling
Status: open
Blocked by: 05
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) fixes the tools `list_adrs(element?, status?)`, `get_adr(id)` and `propose_adr(project, title, elements, body)`; this ticket settles the fields they carry. [View kinds and definitions](10-view-definitions.md) refuses `remove_view` while an ADR links to a View; this ticket decides whether ADRs link Views and in which field.

## Question

What does an ADR file look like? Settle frontmatter (linked Element ids, status lifecycle, supersedes), numbering (per Project or per Workspace), where ADRs that span Projects live, and how the ADR timeline for an Element is put together.
