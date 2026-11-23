import { ElementRef } from "../schema/workspace.ts";
import type { ElementDecl, LoadedWorkspace, Project } from "./model.ts";

/** What an Element reference (`id` or `project:id`) written in `from` resolves to. */
export type Resolved =
  | { ok: true; element: ElementDecl; /** The reference qualifies an id of its own Project. */ ownPrefix: boolean }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "unknown-project"; project: string; id: string }
  | { ok: false; reason: "unknown-element"; project: Project; id: string };

/** Resolves Element references against a loaded Workspace. */
export function referenceResolver(ws: LoadedWorkspace): (ref: unknown, from: Project) => Resolved {
  const projects = new Map<string, Project>();
  for (const p of ws.projects) if (p.id !== undefined && !p.duplicateOf && !projects.has(p.id)) projects.set(p.id, p);
  const elements = new Map<Project, Map<string, ElementDecl>>();
  for (const e of ws.elements) {
    const inProject = elements.get(e.project) ?? new Map<string, ElementDecl>();
    if (!inProject.has(e.id)) inProject.set(e.id, e);
    elements.set(e.project, inProject);
  }

  return (ref, from) => {
    if (!ElementRef.safeParse(ref).success) return { ok: false, reason: "malformed" };
    const [prefix, id] = (ref as string).includes(":") ? (ref as string).split(":") as [string, string] : [undefined, ref as string];
    const project = prefix === undefined ? from : projects.get(prefix);
    if (!project) return { ok: false, reason: "unknown-project", project: prefix!, id };
    const element = elements.get(project)?.get(id);
    if (!element) return { ok: false, reason: "unknown-element", project, id };
    return { ok: true, element, ownPrefix: prefix !== undefined && project === from };
  };
}

/** An Element's qualified id, `project:id`. */
export const qualified = (e: ElementDecl) => `${e.project.id}:${e.id}`;
