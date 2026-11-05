/** Load a workspace from disk into a validated model (P0-04 + P0-03 + P0-05). */
import { diagnostic, sortDiagnostics, type Diagnostic } from "@/domain/diagnostics";
import { normalize } from "@/domain/normalize";
import { DEFAULT_PARSE_LIMITS, parseResources, type ParseLimits } from "@/domain/parse";
import type { ParsedResource } from "@/domain/resources";
import { validateModel } from "@/domain/validate";
import type { ArchitectureModel } from "@/domain/model";
import {
  DEFAULT_DISCOVERY_OPTIONS,
  discoverYamlFiles,
  type DiscoveryOptions,
} from "../fs/discovery";
import { FsError } from "../fs/errors";
import type { WorkspaceRoot } from "../fs/workspace-root";
import { revisionOf, type Revision } from "../persistence/revision";

export interface FileInfo {
  revision: Revision;
  bytes: number;
}

export interface WorkspaceLoad {
  model: ArchitectureModel;
  diagnostics: Diagnostic[];
  /** Every YAML file that was read successfully, by workspace-relative path. */
  files: Record<string, FileInfo>;
  loadedAt: string;
}

export interface LoadOptions {
  parseLimits: ParseLimits;
  discovery: DiscoveryOptions;
}

export const DEFAULT_LOAD_OPTIONS: LoadOptions = {
  parseLimits: DEFAULT_PARSE_LIMITS,
  discovery: DEFAULT_DISCOVERY_OPTIONS,
};

export async function loadWorkspace(
  root: WorkspaceRoot,
  options: LoadOptions = DEFAULT_LOAD_OPTIONS,
  now: () => Date = () => new Date(),
): Promise<WorkspaceLoad> {
  const { files: paths, diagnostics } = await discoverYamlFiles(root, options.discovery);
  const files: Record<string, FileInfo> = {};
  const parsed: ParsedResource[] = [];

  for (const file of paths) {
    let content: string;
    try {
      content = await root.readFile(file, options.parseLimits.maxBytes);
    } catch (err) {
      const fsErr = err as FsError;
      diagnostics.push(
        diagnostic(
          "error",
          fsErr.code === "TOO_LARGE" ? "FS_TOO_LARGE" : "FS_READ_ERROR",
          fsErr.message,
          {
            file,
            ...(fsErr.code === "TOO_LARGE"
              ? { hint: "Split large files into several smaller resource files." }
              : {}),
          },
        ),
      );
      continue;
    }
    files[file] = { revision: revisionOf(content), bytes: Buffer.byteLength(content) };
    const result = parseResources(content, file, options.parseLimits);
    parsed.push(...result.resources);
    diagnostics.push(...result.diagnostics);
  }

  const { model, diagnostics: normalizeDiagnostics } = normalize(parsed);
  return {
    model,
    diagnostics: sortDiagnostics([
      ...diagnostics,
      ...normalizeDiagnostics,
      ...validateModel(model),
    ]),
    files,
    loadedAt: now().toISOString(),
  };
}
