import { isAbsolute, join, normalize } from "node:path";
import type { Issue, LoadedWorkspace, Project } from "../core/model.ts";
import { isWorkspaceFile } from "../core/workspace-files.ts";
import { suggest } from "../core/suggest.ts";
import { Id, Ref } from "../schema/workspace.ts";
import type { YamlFile } from "./document.ts";

/** A place in the Workspace's files, repo-relative. */
export interface SourceRef {
  file: string;
  line: number;
  /** What sits there, in words. */
  what: string;
}

export type WriteErrorCode = "not_found" | "ambiguous" | "invalid_input" | "validation_failed";

/** What a write is about. */
export type WriteItem = "element" | "relationship" | "target" | "deployment" | "team" | "environment" | "project" | "view" | "adr";

export interface Failure {
  ok: false;
  code: WriteErrorCode;
  message: string;
  suggestions?: string[];
  /** For `validation_failed`: the errors the write would introduce, as `check` reports them. */
  issues?: Issue[];
  /** For `ambiguous`: each item the request could mean. */
  candidates?: SourceRef[];
  /** For a refused removal or a clash: everything that still references the item, or that it clashes with. */
  references?: SourceRef[];
}

export const fail = (code: WriteErrorCode, message: string, extra: Partial<Failure> = {}): Failure => ({ ok: false, code, message, ...extra });

/** One write in progress: the Workspace as loaded, and the files it has opened for editing. */
export interface Edit {
  ws: LoadedWorkspace;
  repoRoot: string;
  /** The Workspace root, absolute. */
  root: string;
  /** The file at an absolute path, parsed for editing; the same object on every call. */
  open(abs: string): Promise<YamlFile>;
  /** A file's text as it is on disk, undefined when there is none. */
  read(abs: string): Promise<string | undefined>;
  /** Writes a new non-YAML file (an ADR) whole. */
  create(abs: string, text: string): void;
}

export type Planned =
  | { ok: true; action: "created" | "updated" | "removed"; item: WriteItem; subject: Record<string, string | null> }
  | Failure;

/** An absolute path for a repo-relative one. */
export const absolute = (edit: Edit, repoPath: string) => join(edit.repoRoot, ...repoPath.split("/"));

export function findProject(edit: Edit, id: string): Project | Failure {
  const project = edit.ws.projects.find((p) => p.id === id && !p.duplicateOf);
  if (project) return project;
  const known = edit.ws.projects.flatMap((p) => (p.id === undefined ? [] : [p.id]));
  const near = suggest(id, known);
  return fail("not_found", `No Project "${id}".`, near ? { suggestions: [near] } : {});
}

/** A `file` argument: a `.yaml` path inside the Project's folder, relative to it. */
export function projectFile(edit: Edit, project: Project, file: string): { ok: true; abs: string } | Failure {
  const clean = normalize(file);
  const reserved = ["project.yaml", "workspace.yaml"];
  if (isAbsolute(file) || clean.startsWith("..") || !isWorkspaceFile(clean) || !clean.endsWith(".yaml") || reserved.includes(clean)) {
    return fail("invalid_input", `file "${file}" must be a .yaml path inside the Project's folder, relative to it, other than project.yaml, with no part starting with "." or named node_modules (Load skips those).`);
  }
  return { ok: true, abs: join(edit.repoRoot, ...project.folder.split("/"), clean) };
}

/** The Project's default file for new top-level declarations. */
export const modelFile = (edit: Edit, project: Project) => join(edit.repoRoot, ...project.folder.split("/"), "model.yaml");

/** A bare id for an id written in `project`: `id` or `project:id`. */
export function local(ref: string, project: Project): { ok: true; id: string } | Failure {
  const [prefix, id] = ref.includes(":") ? (ref.split(":", 2) as [string, string]) : [undefined, ref];
  if (prefix !== undefined && prefix !== project.id) return fail("invalid_input", `"${ref}" is not in Project ${project.id}; write tools edit one Project at a time.`);
  if (!Id.safeParse(id).success) return fail("invalid_input", `"${ref}" is not a valid id: use a lowercase slug (a-z, 0-9 and -).`);
  return { ok: true, id };
}

/** A reference as it is written in YAML in `project`: bare for its own ids, `project:id` for another's. */
export function written(ref: string, project: Project, what: string): { ok: true; ref: string } | Failure {
  if (!Ref.safeParse(ref).success) return fail("invalid_input", `${what} "${ref}" must be an id, or project:id for one in another Project.`);
  return { ok: true, ref: ref.startsWith(`${project.id}:`) ? ref.slice(project.id!.length + 1) : ref };
}

/** A bare id for a Team or Environment. */
export function bareId(id: string, what: string): { ok: true; id: string } | Failure {
  if (!Id.safeParse(id).success) return fail("invalid_input", `${what} id "${id}" is not valid: use a lowercase slug (a-z, 0-9 and -).`);
  return { ok: true, id };
}

/** Sets each field at `path`; null deletes it. */
export function setFields(file: YamlFile, path: readonly (string | number)[], fields: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) file.delete([...path, key]);
    else file.set([...path, key], value);
  }
}

/** `fields` without its null values, for a new item. */
export const present = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));

/** Refuses fields a tool manages through its own arguments. */
export function managedFields(fields: Record<string, unknown>, managed: readonly string[], hint: string): Failure | undefined {
  const found = Object.keys(fields).filter((k) => managed.includes(k));
  return found.length > 0 ? fail("invalid_input", `fields may not set ${found.map((k) => `"${k}"`).join(", ")}: ${hint}`) : undefined;
}

export const byPlace = (a: SourceRef, b: SourceRef) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line);
