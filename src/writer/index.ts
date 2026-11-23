import { isAbsolute, join, normalize, sep } from "node:path";
import type { WritableFileSystem } from "../core/fs.ts";
import { loadDetailed } from "../core/load.ts";
import type { ElementDecl, Issue, LoadedWorkspace, Project, RelationshipDecl } from "../core/model.ts";
import { qualified, qualify, referenceResolver } from "../core/refs.ts";
import { suggest } from "../core/suggest.ts";
import { collectionOf, Id, kindOfCollection, Ref, parentKindOf, type ElementKind } from "../schema/workspace.ts";
import { unifiedDiff } from "./diff.ts";
import { YamlFile } from "./document.ts";
import { overlayFileSystem } from "./overlay.ts";

export interface WriterOptions {
  fs: WritableFileSystem;
  /** The Workspace root: the folder holding `workspace.yaml`. */
  root: string;
  /** Paths in results are relative to this; defaults as Load's does. */
  repoRoot?: string;
}

/** One edit to the Model. Ids are bare within `project`, or `project:id`. */
export type WriteRequest =
  | { op: "upsert-element"; project: string; kind: ElementKind; id: string; fields: Record<string, unknown>; parent?: string; file?: string }
  | { op: "remove-element"; project: string; id: string }
  | { op: "upsert-relationship"; project: string; from: string; to: string; fields: Record<string, unknown>; id?: string }
  | { op: "remove-relationship"; project: string; from: string; to: string; id?: string };

/** A place in the Workspace's files, repo-relative. */
export interface SourceRef {
  file: string;
  line: number;
  /** What sits there, in words. */
  what: string;
}

export type WriteErrorCode = "not_found" | "ambiguous" | "invalid_input" | "validation_failed";

export type WriteResult =
  | {
      ok: true;
      action: "created" | "updated" | "removed" | "unchanged";
      /** What was written: `{id}` for an Element, `{from, to, id}` for a Relationship, all qualified. */
      subject: Record<string, string | null>;
      /** Repo-relative paths of the files changed (or that would be, on a dry run). */
      files: string[];
      /** A unified diff of every changed file. */
      diff: string;
      dryRun: boolean;
    }
  | {
      ok: false;
      code: WriteErrorCode;
      message: string;
      suggestions?: string[];
      /** For `validation_failed`: the errors the write would introduce, as `check` reports them. */
      issues?: Issue[];
      /** For `ambiguous`: each item the request could mean. */
      candidates?: SourceRef[];
      /** For a refused removal: everything that still references the item. */
      references?: SourceRef[];
    };

type Failure = Extract<WriteResult, { ok: false }>;
const fail = (code: WriteErrorCode, message: string, extra: Partial<Failure> = {}): Failure => ({ ok: false, code, message, ...extra });

/**
 * The YAML writer. Applies one edit to the Model's YAML files in memory,
 * keeping comments and formatting, checks the whole Workspace with the edit
 * applied through Load, and writes the changed files only if the edit
 * introduces no error and this is not a dry run. Never touches git.
 */
export async function write(options: WriterOptions, request: WriteRequest, { dryRun = false } = {}): Promise<WriteResult> {
  const { fs, root } = options;
  const before = await loadDetailed({ fs, root, ...(options.repoRoot ? { repoRoot: options.repoRoot } : {}) });
  const { workspace: ws, repoRoot } = before;

  const files = new Map<string, YamlFile>();
  const edit: Edit = {
    ws,
    repoRoot,
    async open(abs) {
      let file = files.get(abs);
      if (!file) {
        file = new YamlFile((await fs.exists(abs)) ? await fs.readFile(abs) : null);
        files.set(abs, file);
      }
      return file;
    },
  };

  const project = ws.projects.find((p) => p.id === request.project && !p.duplicateOf);
  if (!project) {
    const known = ws.projects.flatMap((p) => (p.id === undefined ? [] : [p.id]));
    const near = suggest(request.project, known);
    return fail("not_found", `No Project "${request.project}".`, near ? { suggestions: [near] } : {});
  }

  const planned = await plan(edit, project, request);
  if (!planned.ok) return planned;

  const changed = new Map<string, string>();
  for (const [abs, file] of files) {
    const text = file.toString();
    if (text !== file.original) changed.set(abs, text);
  }
  const rel = (abs: string) => abs.slice(repoRoot.length + 1).split(sep).join("/");
  const ordered = [...changed.keys()].sort((a, b) => (rel(a) < rel(b) ? -1 : 1));
  const result = {
    ok: true as const,
    action: changed.size === 0 ? ("unchanged" as const) : planned.action,
    subject: planned.subject,
    files: ordered.map(rel),
    diff: ordered.map((abs) => unifiedDiff(rel(abs), files.get(abs)!.original, changed.get(abs)!)).join(""),
    dryRun,
  };
  if (changed.size === 0) return result;

  const after = await loadDetailed({ fs: overlayFileSystem(fs, changed), root, repoRoot });
  const introduced = introducedErrors(before.issues, after.issues);
  if (introduced.length > 0) {
    return fail("validation_failed", `The write would introduce ${introduced.length} error${introduced.length === 1 ? "" : "s"}; nothing was written.`, { issues: introduced });
  }
  if (!dryRun) for (const abs of ordered) await fs.writeFile(abs, changed.get(abs)!);
  return result;
}

interface Edit {
  ws: LoadedWorkspace;
  repoRoot: string;
  /** The file at an absolute path, parsed for editing; the same object on every call. */
  open(abs: string): Promise<YamlFile>;
}

type Planned = { ok: true; action: "created" | "updated" | "removed"; subject: Record<string, string | null> } | Failure;

async function plan(edit: Edit, project: Project, request: WriteRequest): Promise<Planned> {
  switch (request.op) {
    case "upsert-element":
      return upsertElement(edit, project, request);
    case "upsert-relationship":
      return upsertRelationship(edit, project, request);
    case "remove-element":
      return removeElement(edit, project, request);
    case "remove-relationship":
      return removeRelationship(edit, project, request);
  }
}

/** Keys an Element's `fields` may not set: its children and Relationships have their own tools, and `in:` follows from `parent`. */
const managedKeys = new Set(["relationships", "in", ...Object.keys(kindOfCollection)]);

async function upsertElement(edit: Edit, project: Project, request: Extract<WriteRequest, { op: "upsert-element" }>): Promise<Planned> {
  const id = local(request.id, project);
  if (!id.ok) return id;
  const parentId = request.parent === undefined ? undefined : local(request.parent, project);
  if (parentId && !parentId.ok) return parentId;
  const managed = Object.keys(request.fields).filter((k) => managedKeys.has(k));
  if (managed.length > 0) {
    return fail("invalid_input", `fields may not set ${managed.map((k) => `"${k}"`).join(", ")}: use upsert_relationship for Relationships, and parent for nesting.`);
  }
  const subject = { id: `${project.id}:${id.id}` };
  const abs = (repoPath: string) => join(edit.repoRoot, ...repoPath.split("/"));

  const existing = elementIn(edit.ws, project, id.id);
  if (existing) {
    if (existing.kind !== request.kind) return fail("invalid_input", `${subject.id} is a ${existing.kind}, not a ${request.kind}.`);
    if (parentId && existing.parent?.id !== parentId.id) {
      return fail("invalid_input", `${subject.id} is ${existing.parent ? `in ${project.id}:${existing.parent.id}` : "top-level"}; moving an Element is not supported. Remove it and add it again.`);
    }
    const file = await edit.open(abs(existing.file.path));
    for (const [key, value] of Object.entries(request.fields)) {
      if (value === null) file.delete([...existing.path, key]);
      else file.set([...existing.path, key], value);
    }
    return { ok: true, action: "updated", subject };
  }

  const collection = collectionOf[request.kind];
  const { name, ...rest } = request.fields;
  const fields = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null));
  const named = name === undefined || name === null ? {} : { name };

  const target = request.file === undefined ? undefined : projectFile(edit, project, request.file);
  if (target && !target.ok) return target;

  if (parentId) {
    const parent = elementIn(edit.ws, project, parentId.id);
    if (!parent) return notFoundElement(edit.ws, project, parentId.id);
    if (target && target.abs !== abs(parent.file.path)) {
      // In a file of its own: top-level there, attached with `in:`.
      if (!parentKindOf[request.kind]) return fail("invalid_input", `A ${request.kind} can't attach to a parent with in:, so it must go in its parent's file.`);
      const file = await edit.open(target.abs);
      file.set([collection, id.id], { ...named, in: parent.id, ...fields });
      return { ok: true, action: "created", subject };
    }
    const file = await edit.open(abs(parent.file.path));
    file.set([...parent.path, collection, id.id], { ...named, ...fields });
    return { ok: true, action: "created", subject };
  }

  const file = await edit.open(target?.abs ?? join(edit.repoRoot, ...project.folder.split("/"), "model.yaml"));
  file.set([collection, id.id], { ...named, ...fields });
  return { ok: true, action: "created", subject };
}

async function upsertRelationship(edit: Edit, project: Project, request: Extract<WriteRequest, { op: "upsert-relationship" }>): Promise<Planned> {
  const found = await findRelationship(edit, project, request);
  if (!found.ok) return found;
  const { consumer, to, id, match, subject } = found;
  const managed = Object.keys(request.fields).filter((k) => k === "to" || k === "id");
  if (managed.length > 0) return fail("invalid_input", `fields may not set ${managed.map((k) => `"${k}"`).join(", ")}: pass them as arguments.`);

  const file = await edit.open(join(edit.repoRoot, ...consumer.file.path.split("/")));
  if (match) {
    if (qualify(match.data.to, project) !== qualify(to, project)) file.set([...match.path, "to"], to);
    for (const [key, value] of Object.entries(request.fields)) {
      if (value === null) file.delete([...match.path, key]);
      else file.set([...match.path, key], value);
    }
    return { ok: true, action: "updated", subject };
  }
  const fields = Object.fromEntries(Object.entries(request.fields).filter(([, v]) => v !== null));
  file.append([...consumer.path, "relationships"], { to, ...(id === undefined ? {} : { id }), ...fields });
  return { ok: true, action: "created", subject };
}

type FoundRelationship = {
  ok: true;
  consumer: ElementDecl;
  /** `to` as it is written in YAML: bare within the Project. */
  to: string;
  id?: string;
  /** The Relationship the request names, if it exists. */
  match?: RelationshipDecl;
  subject: Record<string, string | null>;
};

/**
 * The Relationship a request names: `(from, to)` plus `id` if given. An `id`
 * is matched among the consumer's Relationships; without one, several on the
 * pair is `ambiguous`.
 */
async function findRelationship(edit: Edit, project: Project, request: { from: string; to: string; id?: string }): Promise<FoundRelationship | Failure> {
  const from = local(request.from, project);
  if (!from.ok) return from;
  const consumer = elementIn(edit.ws, project, from.id);
  if (!consumer) return notFoundElement(edit.ws, project, from.id);
  if (!Ref.safeParse(request.to).success) return fail("invalid_input", `to "${request.to}" must be an id, or project:id for one in another Project.`);
  const to = request.to.startsWith(`${project.id}:`) ? request.to.slice(project.id!.length + 1) : request.to;
  const toQualified = qualify(to, project)!;
  const id = request.id === undefined ? undefined : local(request.id, project);
  if (id && !id.ok) return id;

  const mine = edit.ws.relationships.filter((r) => r.from === consumer);
  const matches = id ? mine.filter((r) => r.data.id === id.id) : mine.filter((r) => qualify(r.data.to, project) === toQualified);
  if (matches.length > 1) {
    return fail("ambiguous", `${project.id}:${consumer.id} has ${matches.length} Relationships to ${toQualified}; pass the id of the one you mean, or give each an id first.`, {
      candidates: matches.map((r) => ({ file: r.file.path, line: r.line, what: describeRelationship(r, project) })),
    });
  }
  const match = matches[0];
  const ownId = id?.id ?? (typeof match?.data.id === "string" ? match.data.id : undefined);
  return {
    ok: true,
    consumer,
    to,
    ...(id ? { id: id.id } : {}),
    ...(match ? { match } : {}),
    subject: { from: `${project.id}:${consumer.id}`, to: toQualified, id: ownId === undefined ? null : `${project.id}:${ownId}` },
  };
}

function describeRelationship(r: RelationshipDecl, project: Project): string {
  const id = typeof r.data.id === "string" ? ` (${project.id}:${r.data.id})` : "";
  const description = typeof r.data.description === "string" ? `: ${r.data.description}` : "";
  return `Relationship ${r.from.project.id}:${r.from.id} -> ${qualify(r.data.to, r.from.project) ?? String(r.data.to)}${id}${description}`;
}

/**
 * Removes an Element and the Relationships declared under it. Refused while
 * anything else still references it: an Element in it, a Relationship to or
 * via it, or a Deployment of it. Nothing cascades.
 */
async function removeElement(edit: Edit, project: Project, request: Extract<WriteRequest, { op: "remove-element" }>): Promise<Planned> {
  const id = local(request.id, project);
  if (!id.ok) return id;
  const element = elementIn(edit.ws, project, id.id);
  if (!element) return notFoundElement(edit.ws, project, id.id);
  const subject = { id: qualified(element) };

  const resolve = referenceResolver(edit.ws);
  const is = (ref: unknown, from: Project) => {
    const r = resolve(ref, from);
    return r.ok && r.element === element;
  };
  const references: SourceRef[] = [
    ...edit.ws.elements.filter((e) => e.parent === element).map((e) => ({ file: e.file.path, line: e.line, what: `${kindName[e.kind]} ${qualified(e)} is in it` })),
    ...edit.ws.relationships
      .filter((r) => r.from !== element && (is(r.data.to, r.from.project) || is(r.data.via, r.from.project)))
      .map((r) => ({ file: r.file.path, line: r.line, what: describeRelationship(r, r.from.project) })),
    ...edit.ws.deployments
      .filter((d) => d.service === element)
      .map((d) => ({ file: d.file.path, line: d.line, what: `Deployment of ${subject.id} to ${String(d.data.environment)} on ${qualify(d.data.target, d.project) ?? String(d.data.target)}` })),
  ].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  if (references.length > 0) {
    return fail("validation_failed", `${subject.id} is still referenced in ${references.length} place${references.length === 1 ? "" : "s"}; remove or change those first. Nothing was written.`, { references });
  }
  const file = await edit.open(join(edit.repoRoot, ...element.file.path.split("/")));
  file.delete(element.path);
  return { ok: true, action: "removed", subject };
}

async function removeRelationship(edit: Edit, project: Project, request: Extract<WriteRequest, { op: "remove-relationship" }>): Promise<Planned> {
  const found = await findRelationship(edit, project, request);
  if (!found.ok) return found;
  if (!found.match) {
    return fail("not_found", `No Relationship from ${found.subject.from} to ${found.subject.to}${request.id === undefined ? "" : ` with id ${found.subject.id}`}.`);
  }
  const file = await edit.open(join(edit.repoRoot, ...found.consumer.file.path.split("/")));
  file.delete(found.match.path);
  return { ok: true, action: "removed", subject: found.subject };
}

const kindName = { person: "Person", system: "System", service: "Service", component: "Component" } as const;

/** A `file` argument: a `.yaml` path inside the Project's folder, relative to it. */
function projectFile(edit: Edit, project: Project, file: string): { ok: true; abs: string } | Failure {
  const clean = normalize(file);
  const reserved = ["project.yaml", "workspace.yaml"];
  if (isAbsolute(file) || clean.startsWith("..") || !clean.endsWith(".yaml") || reserved.includes(clean)) {
    return fail("invalid_input", `file "${file}" must be a .yaml path inside the Project's folder, relative to it, other than project.yaml.`);
  }
  return { ok: true, abs: join(edit.repoRoot, ...project.folder.split("/"), clean) };
}

/** A bare id for an id written in `project`: `id` or `project:id`. */
function local(ref: string, project: Project): { ok: true; id: string } | Failure {
  const [prefix, id] = ref.includes(":") ? (ref.split(":", 2) as [string, string]) : [undefined, ref];
  if (prefix !== undefined && prefix !== project.id) return fail("invalid_input", `"${ref}" is not in Project ${project.id}; write tools edit one Project at a time.`);
  if (!Id.safeParse(id).success) return fail("invalid_input", `"${ref}" is not a valid id: use a lowercase slug (a-z, 0-9 and -).`);
  return { ok: true, id };
}

function elementIn(ws: LoadedWorkspace, project: Project, id: string): ElementDecl | undefined {
  return ws.elements.find((e) => e.project === project && e.id === id);
}

function notFoundElement(ws: LoadedWorkspace, project: Project, id: string): Failure {
  const near = suggest(id, ws.elements.filter((e) => e.project === project).map((e) => e.id));
  return fail("not_found", `No Element "${project.id}:${id}".`, near ? { suggestions: [`${project.id}:${near}`] } : {});
}

/** Errors in `after` beyond those already in `before`, matched by rule, file and message (lines move as files change). */
function introducedErrors(before: Issue[], after: Issue[]): Issue[] {
  const key = (i: Issue) => `${i.rule}\0${i.file}\0${i.message}`;
  const seen = new Map<string, number>();
  for (const i of before) if (i.severity === "error") seen.set(key(i), (seen.get(key(i)) ?? 0) + 1);
  return after.filter((i) => {
    if (i.severity !== "error") return false;
    const n = seen.get(key(i)) ?? 0;
    if (n > 0) {
      seen.set(key(i), n - 1);
      return false;
    }
    return true;
  });
}
