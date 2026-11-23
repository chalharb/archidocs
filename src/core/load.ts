import { basename, dirname, join, relative, sep } from "node:path";
import { Bundle, SCHEMA_VERSION, type BundleElement } from "../schema/bundle.ts";
import { ProjectFile, WorkspaceFile, childKindOf, collectionOf, kindOfCollection, shallow, workspaceOnlyKeys, type ElementKind } from "../schema/workspace.ts";
import type { FileSystem } from "./fs.ts";
import type { ElementDecl, Finding, Issue, Located, LoadedWorkspace, Project, SourceFile } from "./model.ts";
import { rules } from "./rules.ts";
import { checkSchema } from "./schema-check.ts";
import { parseYaml } from "./yaml.ts";
import type { z } from "zod";

export interface LoadOptions {
  fs: FileSystem;
  /** The Workspace root: the folder holding `workspace.yaml`. */
  root: string;
  /** Issue and source paths are relative to this. Defaults to the nearest ancestor holding `.git`, else `root`. */
  repoRoot?: string;
  /** Recorded in the Bundle header. */
  commit?: string | null;
  builtAt?: string | null;
}

export interface LoadResult {
  bundle: Bundle;
  issues: Issue[];
}

const WORKSPACE_FILE = "workspace.yaml";
const PROJECT_FILE = "project.yaml";

/**
 * Reads a Workspace: discovers Projects, parses and merges their files,
 * resolves references and runs every check rule. The Bundle is always
 * returned; callers must not publish it when `issues` holds an error.
 */
export async function load(options: LoadOptions): Promise<LoadResult> {
  const { fs, root } = options;
  const repoRoot = options.repoRoot ?? (await findRepoRoot(fs, root));
  const toRepoPath = (abs: string) => relative(repoRoot, abs).split(sep).join("/");

  const { files: yamlPaths, dirs } = await walk(fs, root);
  const projectDirs = dirs.filter((d) => yamlPaths.includes(join(d, PROJECT_FILE)));
  const nearestProjectDir = (dir: string, strict: boolean) =>
    projectDirs
      .filter((p) => (strict ? dir.startsWith(p + sep) : dir === p || dir.startsWith(p + sep)))
      .sort((a, b) => b.length - a.length)[0];

  const ws: LoadedWorkspace = { files: [], projects: [], teams: [], environments: [], elements: [] };
  const projectByDir = new Map<string, Project>();

  // Read every file; project.yaml files first so model files can find their Project.
  const ordered = [...yamlPaths].sort((a, b) => Number(basename(b) === PROJECT_FILE) - Number(basename(a) === PROJECT_FILE) || cmp(a, b));
  for (const abs of ordered) {
    const parsed = parseYaml(await fs.readFile(abs));
    const dir = dirname(abs);
    const role: SourceFile["role"] =
      abs === join(root, WORKSPACE_FILE) ? "workspace" : basename(abs) === PROJECT_FILE ? "project" : nearestProjectDir(dir, false) ? "model" : "outside";
    const file: SourceFile = { path: toRepoPath(abs), role, parsed, findings: [] };
    ws.files.push(file);
    if (parsed.data === undefined) {
      if (role === "project") projectByDir.set(dir, { name: "", folder: toRepoPath(dir), file });
      continue;
    }

    if (role === "workspace") readWorkspaceFile(file, ws);
    else if (role === "project") projectByDir.set(dir, readProjectFile(file, toRepoPath(dir)));
    else if (role === "model") {
      file.project = projectByDir.get(nearestProjectDir(dir, false)!)!;
      readModelFile(file, ws);
    }
  }
  ws.files.sort((a, b) => cmp(a.path, b.path));

  // Projects in folder order: nesting and duplicate ids point back at the earlier one.
  const firstById = new Map<string, Project>();
  for (const [dir, project] of [...projectByDir].sort(([a], [b]) => cmp(a, b))) {
    project.file.project = project;
    const outer = nearestProjectDir(dir, true);
    if (outer) project.nestedIn = projectByDir.get(outer);
    if (project.id !== undefined) {
      const first = firstById.get(project.id);
      if (first) project.duplicateOf = first;
      else firstById.set(project.id, project);
    }
    ws.projects.push(project);
  }
  ws.elements.sort((a, b) => cmp(a.file.path, b.file.path) || a.line - b.line);
  resolveParents(ws);

  const issues = rules
    .flatMap((rule) => rule.check(ws).map(({ file, line, column, message }) => ({ file, line, ...(column === undefined ? {} : { column }), rule: rule.id, severity: rule.severity, message })))
    .sort((a, b) => cmp(a.file, b.file) || a.line - b.line || cmp(a.rule, b.rule) || (a.column ?? 0) - (b.column ?? 0) || cmp(a.message, b.message));

  return { bundle: toBundle(ws, options), issues };
}

/** Walks up from `start` to the folder holding `workspace.yaml`, also looking in each folder's `archidocs/`. */
export async function findWorkspaceRoot(fs: FileSystem, start: string): Promise<string | undefined> {
  for (let dir = start; ; dir = dirname(dir)) {
    for (const candidate of [dir, join(dir, "archidocs")]) {
      if (await fs.exists(join(candidate, WORKSPACE_FILE))) return candidate;
    }
    if (dirname(dir) === dir) return undefined;
  }
}

async function findRepoRoot(fs: FileSystem, root: string): Promise<string> {
  for (let dir = root; ; dir = dirname(dir)) {
    if (await fs.exists(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return root;
  }
}

async function walk(fs: FileSystem, root: string): Promise<{ files: string[]; dirs: string[] }> {
  const files: string[] = [];
  const dirs: string[] = [root];
  for (let i = 0; i < dirs.length; i++) {
    for (const entry of await fs.readDir(dirs[i]!)) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(dirs[i]!, entry.name);
      if (entry.isDirectory) dirs.push(path);
      else if (entry.name.endsWith(".yaml")) files.push(path);
    }
  }
  return { files: files.sort(cmp), dirs: dirs.sort(cmp) };
}

function readWorkspaceFile(file: SourceFile, ws: LoadedWorkspace) {
  const data = asRecord(file.parsed.data);
  file.findings.push(...checkSchema(WorkspaceFile, data, file.parsed));
  for (const [key, list] of [["teams", ws.teams], ["environments", ws.environments]] as const) {
    for (const [id, value] of Object.entries(asRecord(data[key]))) {
      list.push({ id, file, data: asRecord(value), ...file.parsed.positionOf([key, id], { key: true }) });
    }
  }
}

function readProjectFile(file: SourceFile, folder: string): Project {
  const data = withoutWorkspaceKeys(file);
  file.findings.push(...checkSchema(ProjectFile, data, file.parsed));
  const valid = ProjectFile.safeParse(data);
  return {
    id: valid.success || typeof data.id === "string" ? String(data.id) : undefined,
    name: typeof data.name === "string" ? data.name : "",
    owner: typeof data.owner === "string" ? data.owner : undefined,
    folder,
    file,
  };
}

function readModelFile(file: SourceFile, ws: LoadedWorkspace) {
  const data = withoutWorkspaceKeys(file);
  file.findings.push(...checkSchema(shallow.file, data, file.parsed));
  readElements(file, ws, data, [], undefined);
}

/**
 * Registers every Element declared under `container` (a file's top level, or
 * an Element), recursing into nested collections. A collection under the
 * wrong kind (say `components` under a System) is still read, so its Elements
 * keep their ids; `invalid-nesting` reports them.
 */
function readElements(file: SourceFile, ws: LoadedWorkspace, container: Record<string, unknown>, at: string[], nestedIn: ElementDecl | undefined) {
  for (const [key, kind] of Object.entries(kindOfCollection)) {
    for (const [id, value] of Object.entries(asRecord(container[key]))) {
      const path = [...at, key, id];
      const data = asRecord(value);
      // Each Element is checked on its own, without collections that `invalid-nesting` reports; a bad one still registers its id.
      if (value !== null && typeof value === "object") {
        file.findings.push(...checkSchema(shallow[kind], withoutForeignCollections(kind, data), file.parsed, path));
      }
      const element: ElementDecl = { kind, id, project: file.project!, file, path, data, nestedIn, ...file.parsed.positionOf(path, { key: true }) };
      ws.elements.push(element);
      readElements(file, ws, data, path, element);
    }
  }
}

function withoutForeignCollections(kind: ElementKind, data: Record<string, unknown>): Record<string, unknown> {
  const own = childKindOf[kind] && collectionOf[childKindOf[kind]];
  return Object.fromEntries(Object.entries(data).filter(([k]) => k === own || !(k in kindOfCollection)));
}

/** Sets each Element's parent: the Element it is nested under, else the one its `in:` names in its Project. */
function resolveParents(ws: LoadedWorkspace) {
  const byId = new Map<string, ElementDecl>();
  for (const e of ws.elements) {
    const key = `${e.project.folder}\0${e.id}`;
    if (!byId.has(key)) byId.set(key, e);
  }
  for (const e of ws.elements) {
    const ref = e.data.in;
    e.parent = e.nestedIn ?? (typeof ref === "string" ? byId.get(`${e.project.folder}\0${ref}`) : undefined);
  }
}

/** Reports and drops `teams`/`environments` from a file other than `workspace.yaml`. */
function withoutWorkspaceKeys(file: SourceFile): Record<string, unknown> {
  const data = { ...asRecord(file.parsed.data) };
  for (const key of workspaceOnlyKeys) {
    if (!(key in data)) continue;
    delete data[key];
    const finding: Finding = {
      rule: "definition-outside-workspace",
      ...file.parsed.positionOf([key], { key: true }),
      message: `"${key}" may only be defined in workspace.yaml`,
    };
    file.findings.push(finding);
  }
  return data;
}

function toBundle(ws: LoadedWorkspace, options: LoadOptions): Bundle {
  const source = (l: { file: SourceFile; line: number }) => ({ file: l.file.path, line: l.line });
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const links = (v: unknown) =>
    Array.isArray(v) ? v.map(asRecord).map((l) => ({ label: String(l.label ?? ""), url: String(l.url ?? "") })) : [];
  const byId = <T extends { id: string }>(a: T, b: T) => cmp(a.id, b.id);
  const projects = ws.projects.filter((p): p is Project & { id: string } => p.id !== undefined && !p.duplicateOf);

  const elements: BundleElement[] = ws.elements
    .filter((e) => e.project.id !== undefined && !e.project.duplicateOf)
    .map((e): BundleElement => {
      const d = e.data;
      const common = {
        id: `${e.project.id}:${e.id}`,
        parent: e.parent ? `${e.parent.project.id}:${e.parent.id}` : null,
        name: str(d.name) ?? e.id,
        description: str(d.description),
        owner: str(d.owner) ?? e.project.owner ?? "",
        tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
        links: links(d.links),
        source: source(e),
      };
      const external = d.external === true;
      const technology = str(d.technology);
      switch (e.kind) {
        case "person":
          return { ...common, kind: e.kind };
        case "system":
          return { ...common, kind: e.kind, external };
        case "service":
          return { ...common, kind: e.kind, type: (["app", "datastore", "broker"] as const).find((t) => t === d.type) ?? "app", technology, external };
        case "component":
          return { ...common, kind: e.kind, technology };
      }
    });

  const bundle: z.input<typeof Bundle> = {
    schemaVersion: SCHEMA_VERSION,
    commit: options.commit ?? null,
    builtAt: options.builtAt ?? null,
    teams: ws.teams
      .map((t: Located<Record<string, unknown>>) => ({ id: t.id, name: str(t.data.name) ?? t.id, description: str(t.data.description), links: links(t.data.links), source: source(t) }))
      .sort(byId),
    environments: ws.environments
      .map((e) => ({ id: e.id, name: str(e.data.name) ?? e.id, description: str(e.data.description), source: source(e) }))
      .sort(byId),
    projects: projects
      .map((p) => ({ id: p.id, name: p.name, owner: p.owner ?? "", folder: p.folder, source: { file: p.file.path, line: 1 } }))
      .sort(byId),
    elements: elements.sort(byId),
    relationships: [],
    targets: [],
    deployments: [],
  };
  // Parsing fixes key order to the schema's.
  return Bundle.parse(bundle);
}

/** The Bundle as written to `workspace.bundle.json`: stable key order, two-space indent. */
export function serializeBundle(bundle: Bundle): string {
  return JSON.stringify(Bundle.parse(bundle), null, 2) + "\n";
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
