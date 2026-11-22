# History UX

Type: grilling
Status: open
Blocked by: 07, 14
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) reserves an `at` (commit) argument on read tools for this ticket.

## Question

How does the Technical resource see how the Workspace changed over time, in the viewer and through MCP? The Workspace is one repo, and a Workspace Bundle can be rebuilt for any commit ([Workspace aggregation](07-workspace-aggregation.md)). Settle: how two points in time are picked (commits, tags, dates), what a diff between two Bundles reports (Elements, Relationships, Deployments and Owners added, removed or changed) and how the viewer shows it, whether past Bundles are built on demand or cached in CI and where, and the MCP tool shape for "what changed".
