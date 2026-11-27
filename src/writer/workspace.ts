import { isAbsolute, join, normalize, relative, sep } from "node:path";
import type { Located } from "../core/model.ts";
import { isWorkspaceFile } from "../core/workspace-files.ts";
import { absolute, bareId, fail, present, setFields, type Edit, type Planned, type SourceRef } from "./edit.ts";

export type DefinitionRequest =
  | { op: "upsert-team"; id: string; fields: Record<string, unknown> }
  | { op: "upsert-environment"; id: string; fields: Record<string, unknown> };

export type ProjectRequest = { op: "create-project"; id: string; name: string; owner: string; folder?: string };

/** Adds a Team or an Environment to `workspace.yaml`, or updates the fields of an existing one. */
export async function upsertDefinition(edit: Edit, request: DefinitionRequest): Promise<Planned> {
  const [key, item, what, list] =
    request.op === "upsert-team"
      ? (["teams", "team", "Team", edit.ws.teams] as const)
      : (["environments", "environment", "Environment", edit.ws.environments] as const);
  const id = bareId(request.id, what);
  if (!id.ok) return id;
  const subject = { id: id.id };
  const existing = (list as Located<unknown>[]).find((d) => d.id === id.id);
  if (existing) {
    setFields(await edit.open(absolute(edit, existing.file.path)), [key, id.id], request.fields);
    return { ok: true, action: "updated", item, subject };
  }
  const { name, ...rest } = request.fields;
  const file = await edit.open(join(edit.root, "workspace.yaml"));
  file.set([key, id.id], { ...(name == null ? {} : { name }), ...present(rest) });
  return { ok: true, action: "created", item, subject };
}

/**
 * Writes a new Project's `project.yaml` into `folder` (relative to the
 * Workspace root; `<id>/` by default). Refused for an id already in use, and
 * for a folder inside another Project or holding one.
 */
export async function createProject(edit: Edit, request: ProjectRequest): Promise<Planned> {
  const id = bareId(request.id, "Project");
  if (!id.ok) return id;
  const subject = { id: id.id };
  const declared = (p: (typeof edit.ws.projects)[number], what: string): SourceRef => ({ file: p.file.path, line: p.file.parsed.positionOf(["id"], { key: true }).line, what });

  const same = edit.ws.projects.find((p) => p.id === id.id);
  if (same) {
    return fail("validation_failed", `A Project with id "${id.id}" already exists in ${same.folder}; nothing was written.`, { references: [declared(same, `Project ${id.id}`)] });
  }

  const folder = normalize(request.folder ?? id.id);
  if (isAbsolute(folder) || folder === "." || folder.startsWith("..") || !isWorkspaceFile(`${folder}/project.yaml`)) {
    return fail("invalid_input", `folder "${request.folder}" must be a folder inside the Workspace root, relative to it, with no part starting with "." or named node_modules (Load skips those).`);
  }
  const abs = join(edit.root, folder);
  const repoFolder = relative(edit.repoRoot, abs).split(sep).join("/");
  const inside = (outer: string, inner: string) => inner === outer || inner.startsWith(`${outer}/`);
  const clashes = [
    ...edit.ws.projects.filter((p) => inside(p.folder, repoFolder)).map((p) => declared(p, `Project ${p.id ?? "(no id)"} in ${p.folder} would contain it`)),
    ...edit.ws.projects.filter((p) => p.folder !== repoFolder && inside(repoFolder, p.folder)).map((p) => declared(p, `Project ${p.id ?? "(no id)"} in ${p.folder} would be inside it`)),
  ];
  if (clashes.length > 0) {
    return fail("validation_failed", `Projects can't nest: ${repoFolder} overlaps ${clashes.length === 1 ? "another Project" : `${clashes.length} Projects`}; nothing was written.`, { references: clashes });
  }

  const file = await edit.open(join(abs, "project.yaml"));
  file.set(["id"], id.id);
  file.set(["name"], request.name);
  file.set(["owner"], request.owner);
  return { ok: true, action: "created", item: "project", subject };
}
