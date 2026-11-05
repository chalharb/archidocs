/** URLs of a diagram's view and edit routes (DIAG-12, ADD-007). */
export type DiagramMode = "view" | "edit";

export function diagramHref(
  workspace: string,
  diagram: string,
  mode: DiagramMode = "view",
  focus?: string,
): string {
  const base = `/workspaces/${encodeURIComponent(workspace)}/diagrams/${encodeURIComponent(diagram)}`;
  const path = mode === "edit" ? `${base}/edit` : base;
  return focus !== undefined ? `${path}?focus=${encodeURIComponent(focus)}` : path;
}
