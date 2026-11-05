/** URLs of documentation pages (DOC-06, ADD-009). */
import { diagramHref } from "../diagram/links";
import type { LinkTarget } from "@/server/workspace/documentation-views";

const ws = (workspace: string) => `/workspaces/${encodeURIComponent(workspace)}`;

export const documentsHref = (workspace: string) => `${ws(workspace)}/docs`;
export const documentHref = (workspace: string, id: string) =>
  `${documentsHref(workspace)}/${encodeURIComponent(id)}`;
export const decisionsHref = (workspace: string) => `${ws(workspace)}/decisions`;
export const decisionHref = (workspace: string, id: string) =>
  `${decisionsHref(workspace)}/${encodeURIComponent(id)}`;
export const entityHref = (workspace: string, id: string) =>
  `${ws(workspace)}/entities/${encodeURIComponent(id)}`;

/** Where an entity link goes: its first diagram, focused, or its entity page (DOC-06). */
export function entityTargetHref(workspace: string, id: string, diagram?: string): string {
  return diagram !== undefined
    ? diagramHref(workspace, diagram, "view", id)
    : entityHref(workspace, id);
}

export function linkTargetHref(workspace: string, target: LinkTarget): string {
  switch (target.kind) {
    case "entity":
      return entityTargetHref(workspace, target.id, target.diagram);
    case "diagram":
      return diagramHref(workspace, target.id);
    case "decision":
      return decisionHref(workspace, target.id);
    case "document":
      return documentHref(workspace, target.id);
  }
}
