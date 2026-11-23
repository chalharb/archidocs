import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Project, ViewDecl } from "../core/model.ts";
import { suggest } from "../core/suggest.ts";
import { DynamicView, StructuralView } from "../schema/workspace.ts";
import { absolute, fail, findProject, local, modelFile, projectFile, type Edit, type Failure, type Planned } from "./edit.ts";

export type ViewRequest =
  | { op: "upsert-view"; project: string; id: string; definition: Record<string, unknown>; file?: string }
  | { op: "remove-view"; project: string; id: string };

/**
 * Adds a Saved View, or replaces the definition of an existing one: a
 * definition with `steps` is a Dynamic View under `views: dynamic:`, any other
 * a structural View under `views: structural:`. The definition is checked
 * against the same schema Load uses. An existing View is edited key by key: keys whose value
 * is unchanged are left alone (with their comments), changed ones are set,
 * and keys the definition leaves out are removed; one changing kind moves to
 * the other map in its file. A new View goes into `file`, else the Project's
 * `model.yaml`.
 */
export async function upsertView(edit: Edit, request: Extract<ViewRequest, { op: "upsert-view" }>): Promise<Planned> {
  const project = findProject(edit, request.project);
  if ("ok" in project) return project;
  const id = local(request.id, project);
  if (!id.ok) return id;
  const kind = "steps" in request.definition ? "dynamic" : "structural";
  const parsed = (kind === "dynamic" ? DynamicView : StructuralView).safeParse(request.definition);
  if (!parsed.success) return fail("invalid_input", `definition is not a valid ${kind === "dynamic" ? "Dynamic" : "Saved"} View: ${z.prettifyError(parsed.error)}`);
  const subject = { id: `${project.id}:${id.id}` };

  const existing = viewIn(edit, project, id.id);
  if (existing && existing.kind !== kind) {
    const file = await edit.open(absolute(edit, existing.file.path));
    file.delete(existing.path);
    file.set(["views", kind, id.id], request.definition);
    return { ok: true, action: "updated", item: "view", subject };
  }
  if (existing) {
    const file = await edit.open(absolute(edit, existing.file.path));
    for (const key of Object.keys(existing.data)) if (!(key in request.definition)) file.delete([...existing.path, key]);
    for (const [key, value] of Object.entries(request.definition)) {
      if (!isDeepStrictEqual(file.get([...existing.path, key]), value)) file.set([...existing.path, key], value);
    }
    return { ok: true, action: "updated", item: "view", subject };
  }
  const target = request.file === undefined ? undefined : projectFile(edit, project, request.file);
  if (target && !target.ok) return target;
  (await edit.open(target?.abs ?? modelFile(edit, project))).set(["views", kind, id.id], request.definition);
  return { ok: true, action: "created", item: "view", subject };
}

/** Removes a Saved View. */
export async function removeView(edit: Edit, request: Extract<ViewRequest, { op: "remove-view" }>): Promise<Planned> {
  const project = findProject(edit, request.project);
  if ("ok" in project) return project;
  const id = local(request.id, project);
  if (!id.ok) return id;
  const view = viewIn(edit, project, id.id);
  if (!view) return notFoundView(edit, project, id.id);
  (await edit.open(absolute(edit, view.file.path))).delete(view.path);
  return { ok: true, action: "removed", item: "view", subject: { id: `${project.id}:${view.id}` } };
}

function viewIn(edit: Edit, project: Project, id: string): ViewDecl | undefined {
  return edit.ws.views.find((v) => v.project === project && v.id === id);
}

function notFoundView(edit: Edit, project: Project, id: string): Failure {
  const near = suggest(id, edit.ws.views.filter((v) => v.project === project).map((v) => v.id));
  return fail("not_found", `No View "${project.id}:${id}".`, near ? { suggestions: [`${project.id}:${near}`] } : {});
}
