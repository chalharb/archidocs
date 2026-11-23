import type { ElementKind } from "../schema/workspace.ts";
import type { SchemaFinding } from "./schema-check.ts";
import type { ParsedYaml, Position } from "./yaml.ts";

export type Severity = "error" | "warning";

/** One problem found in a Workspace. `file` is relative to the repo root. */
export interface Issue {
  file: string;
  line: number;
  column?: number;
  rule: string;
  severity: Severity;
  message: string;
}

/** An issue as a rule's check reports it; the registry adds rule id and severity. */
export interface IssueDraft {
  file: string;
  line: number;
  column?: number;
  message: string;
}

export type FileRole = "workspace" | "project" | "model" | "outside";

export interface Finding extends Position {
  rule: SchemaFinding["rule"] | "definition-outside-workspace";
  message: string;
}

/** A `*.yaml` file found under the Workspace root. */
export interface SourceFile {
  /** Repo-relative, with `/` separators. */
  path: string;
  role: FileRole;
  project?: Project;
  parsed: ParsedYaml;
  /** Schema problems found while reading the file. */
  findings: Finding[];
}

export interface Project {
  /** Undefined when `project.yaml` has no usable id. */
  id?: string;
  name: string;
  owner?: string;
  ownerPosition?: Position;
  /** Repo-relative folder. */
  folder: string;
  file: SourceFile;
  /** The Project whose folder contains this one, if any. */
  nestedIn?: Project;
  /** An earlier Project (in path order) with the same id, if any. */
  duplicateOf?: Project;
}

export interface Located<T> extends Position {
  id: string;
  file: SourceFile;
  data: T;
}

export interface ElementDecl extends Position {
  kind: ElementKind;
  id: string;
  project: Project;
  file: SourceFile;
  /** Where the declaration sits in its file, e.g. `["systems", "shop", "services", "web"]`. */
  path: string[];
  data: Record<string, unknown>;
  /** The Element it is nested under in its file, if any. */
  nestedIn?: ElementDecl;
  /** Its parent: the Element it is nested under, or the one its `in:` names. Set once every file is read. */
  parent?: ElementDecl;
}

export interface TargetDecl extends Position {
  id: string;
  project: Project;
  file: SourceFile;
  /** Where the declaration sits in its file, e.g. `["targets", "aws-eu", "targets", "eks-prod"]`. */
  path: string[];
  data: Record<string, unknown>;
  /** The Target it is nested under, if any. */
  parent?: TargetDecl;
}

export interface DeploymentDecl extends Position {
  project: Project;
  file: SourceFile;
  /** `["deployments", index]` in its file. */
  path: (string | number)[];
  data: Record<string, unknown>;
  /** What `service` and `target` resolve to, if anything. Set once every file is read. */
  service?: ElementDecl;
  target?: TargetDecl;
}

/** Everything Load read from disk, before rules run and the Bundle is built. */
export interface LoadedWorkspace {
  files: SourceFile[];
  /** Sorted by folder. */
  projects: Project[];
  teams: Located<Record<string, unknown>>[];
  environments: Located<Record<string, unknown>>[];
  /** Sorted by file, then line. */
  elements: ElementDecl[];
  /** Sorted by file, then line. */
  targets: TargetDecl[];
  /** Sorted by file, then line. */
  deployments: DeploymentDecl[];
}
