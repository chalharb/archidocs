import type { DeploymentDecl, Project, TargetDecl } from "../core/model.ts";
import { qualify } from "../core/refs.ts";
import { suggest } from "../core/suggest.ts";
import {
  absolute,
  bareId,
  byPlace,
  fail,
  findProject,
  local,
  managedFields,
  modelFile,
  present,
  projectFile,
  setFields,
  written,
  type Edit,
  type Failure,
  type Planned,
  type SourceRef,
} from "./edit.ts";

export type TargetRequest =
  | { op: "upsert-target"; project: string; id: string; fields: Record<string, unknown>; parent?: string; file?: string }
  | { op: "remove-target"; project: string; id: string };

export type DeploymentRequest =
  | { op: "upsert-deployment"; project: string; service: string; environment: string; target: string; fields: Record<string, unknown>; file?: string }
  | { op: "remove-deployment"; project: string; service: string; environment: string; target: string };

/**
 * Adds a Deployment Target, or updates the fields of an existing one. A new
 * Target nests under `parent` in the parent's file (Targets have no `in:`);
 * a new top-level one goes into `file`, else the Project's `model.yaml`.
 */
export async function upsertTarget(edit: Edit, request: Extract<TargetRequest, { op: "upsert-target" }>): Promise<Planned> {
  const project = findProject(edit, request.project);
  if ("ok" in project) return project;
  const id = local(request.id, project);
  if (!id.ok) return id;
  const parentId = request.parent === undefined ? undefined : local(request.parent, project);
  if (parentId && !parentId.ok) return parentId;
  const managed = managedFields(request.fields, ["targets"], "nest a Target with parent instead.");
  if (managed) return managed;
  const subject = { id: `${project.id}:${id.id}` };

  const existing = targetIn(edit, project, id.id);
  if (existing) {
    if (parentId && existing.parent?.id !== parentId.id) {
      return fail("invalid_input", `${subject.id} is ${existing.parent ? `in ${project.id}:${existing.parent.id}` : "top-level"}; moving a Target is not supported. Remove it and add it again.`);
    }
    setFields(await edit.open(absolute(edit, existing.file.path)), existing.path, request.fields);
    return { ok: true, action: "updated", item: "target", subject };
  }

  const { name, kind, ...rest } = request.fields;
  const value = { ...(name == null ? {} : { name }), ...(kind == null ? {} : { kind }), ...present(rest) };
  const target = request.file === undefined ? undefined : projectFile(edit, project, request.file);
  if (target && !target.ok) return target;

  if (parentId) {
    const parent = targetIn(edit, project, parentId.id);
    if (!parent) return notFoundTarget(edit, project, parentId.id);
    if (target && target.abs !== absolute(edit, parent.file.path)) return fail("invalid_input", "A Target nests only in its parent's file; leave out file, or parent.");
    (await edit.open(absolute(edit, parent.file.path))).set([...parent.path, "targets", id.id], value);
    return { ok: true, action: "created", item: "target", subject };
  }
  (await edit.open(target?.abs ?? modelFile(edit, project))).set(["targets", id.id], value);
  return { ok: true, action: "created", item: "target", subject };
}

/** Removes a Target. Refused while a Target is nested in it or a Deployment uses it; nothing cascades. */
export async function removeTarget(edit: Edit, request: Extract<TargetRequest, { op: "remove-target" }>): Promise<Planned> {
  const project = findProject(edit, request.project);
  if ("ok" in project) return project;
  const id = local(request.id, project);
  if (!id.ok) return id;
  const target = targetIn(edit, project, id.id);
  if (!target) return notFoundTarget(edit, project, id.id);
  const subject = { id: `${project.id}:${target.id}` };

  const references: SourceRef[] = [
    ...edit.ws.targets.filter((t) => t.parent === target).map((t) => ({ file: t.file.path, line: t.line, what: `Target ${t.project.id}:${t.id} is in it` })),
    ...edit.ws.deployments.filter((d) => d.target === target).map((d) => ({ file: d.file.path, line: d.line, what: describeDeployment(d) })),
  ].sort(byPlace);
  if (references.length > 0) {
    return fail("validation_failed", `${subject.id} is still referenced in ${references.length} place${references.length === 1 ? "" : "s"}; remove or change those first. Nothing was written.`, { references });
  }
  (await edit.open(absolute(edit, target.file.path))).delete(target.path);
  return { ok: true, action: "removed", item: "target", subject };
}

/**
 * Adds a Deployment, or updates the fields of the one its (Service,
 * Environment, Target) triple names. A new one is appended to `file`, else
 * beside the Project's other Deployments, else to the Project's `model.yaml`.
 */
export async function upsertDeployment(edit: Edit, request: Extract<DeploymentRequest, { op: "upsert-deployment" }>): Promise<Planned> {
  const found = findDeployment(edit, request);
  if (!found.ok) return found;
  const { project, service, environment, target, match, subject } = found;
  const managed = managedFields(request.fields, ["service", "environment", "target"], "pass them as arguments; they name the Deployment.");
  if (managed) return managed;

  if (match) {
    setFields(await edit.open(absolute(edit, match.file.path)), match.path, request.fields);
    return { ok: true, action: "updated", item: "deployment", subject };
  }
  let abs: string;
  if (request.file !== undefined) {
    const file = projectFile(edit, project, request.file);
    if (!file.ok) return file;
    abs = file.abs;
  } else {
    const beside = edit.ws.deployments.find((d) => d.project === project);
    abs = beside ? absolute(edit, beside.file.path) : modelFile(edit, project);
  }
  (await edit.open(abs)).append(["deployments"], { service, environment, target, ...present(request.fields) });
  return { ok: true, action: "created", item: "deployment", subject };
}

export async function removeDeployment(edit: Edit, request: Extract<DeploymentRequest, { op: "remove-deployment" }>): Promise<Planned> {
  const found = findDeployment(edit, request);
  if (!found.ok) return found;
  const { match, subject } = found;
  if (!match) return fail("not_found", `No Deployment of ${subject.service} to ${subject.environment} on ${subject.target} in Project ${found.project.id}.`);
  (await edit.open(absolute(edit, match.file.path))).delete(match.path);
  return { ok: true, action: "removed", item: "deployment", subject };
}

type FoundDeployment = {
  ok: true;
  project: Project;
  /** `service`, `environment` and `target` as they are written in YAML. */
  service: string;
  environment: string;
  target: string;
  match?: DeploymentDecl;
  subject: { service: string; environment: string; target: string };
};

/** The Deployment a triple names among the Project's Deployments, if any. Several is `ambiguous`. */
function findDeployment(edit: Edit, request: { project: string; service: string; environment: string; target: string }): FoundDeployment | Failure {
  const project = findProject(edit, request.project);
  if ("ok" in project) return project;
  const service = written(request.service, project, "service");
  if (!service.ok) return service;
  const target = written(request.target, project, "target");
  if (!target.ok) return target;
  const environment = bareId(request.environment, "Environment");
  if (!environment.ok) return environment;

  const subject = { service: qualify(service.ref, project)!, environment: environment.id, target: qualify(target.ref, project)! };
  const matches = edit.ws.deployments.filter(
    (d) => d.project === project && qualify(d.data.service, project) === subject.service && d.data.environment === subject.environment && qualify(d.data.target, project) === subject.target,
  );
  if (matches.length > 1) {
    return fail("ambiguous", `Project ${project.id} declares ${matches.length} Deployments of ${subject.service} to ${subject.environment} on ${subject.target}; remove the duplicates by hand first.`, {
      candidates: matches.map((d) => ({ file: d.file.path, line: d.line, what: describeDeployment(d) })),
    });
  }
  return { ok: true, project, service: service.ref, environment: environment.id, target: target.ref, ...(matches[0] ? { match: matches[0] } : {}), subject };
}

function describeDeployment(d: DeploymentDecl): string {
  return `Deployment of ${qualify(d.data.service, d.project) ?? String(d.data.service)} to ${String(d.data.environment)} on ${qualify(d.data.target, d.project) ?? String(d.data.target)}`;
}

function targetIn(edit: Edit, project: Project, id: string): TargetDecl | undefined {
  return edit.ws.targets.find((t) => t.project === project && t.id === id);
}

function notFoundTarget(edit: Edit, project: Project, id: string): Failure {
  const near = suggest(id, edit.ws.targets.filter((t) => t.project === project).map((t) => t.id));
  return fail("not_found", `No Deployment Target "${project.id}:${id}".`, near ? { suggestions: [`${project.id}:${near}`] } : {});
}
