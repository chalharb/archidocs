/**
 * Workspace discovery (P0-04): find YAML resource files under a root.
 * Hidden entries (e.g. .git, .archidoc) and node_modules are skipped. Output is
 * sorted so later stages never depend on directory iteration order.
 */
import { diagnostic, type Diagnostic } from "@/domain/diagnostics";
import { compareCodePoints } from "@/domain/order";
import { FsError } from "./errors";
import type { WorkspaceRoot } from "./workspace-root";

export interface DiscoveryOptions {
  maxFiles: number;
  maxDirectoryDepth: number;
}

export const DEFAULT_DISCOVERY_OPTIONS: DiscoveryOptions = {
  maxFiles: 5000,
  maxDirectoryDepth: 32,
};

const YAML_FILE = /\.ya?ml$/i;

export function isIgnoredName(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

export function isYamlFile(name: string): boolean {
  return YAML_FILE.test(name);
}

export async function discoverYamlFiles(
  root: WorkspaceRoot,
  options: DiscoveryOptions = DEFAULT_DISCOVERY_OPTIONS,
): Promise<{ files: string[]; diagnostics: Diagnostic[] }> {
  const files: string[] = [];
  const diagnostics: Diagnostic[] = [];
  let truncated = false;

  async function walk(dir: string, depth: number): Promise<void> {
    if (truncated) return;
    if (depth > options.maxDirectoryDepth) {
      diagnostics.push(
        diagnostic(
          "warning",
          "FS_TOO_MANY_FILES",
          `Directory nesting exceeds ${options.maxDirectoryDepth} levels; skipped`,
          {
            file: dir,
          },
        ),
      );
      return;
    }
    let entries;
    try {
      entries = await root.listDir(dir);
    } catch (err) {
      diagnostics.push(
        diagnostic(
          "error",
          "FS_READ_ERROR",
          `Cannot read directory '${dir || "."}': ${(err as FsError).message}`,
          {
            ...(dir ? { file: dir } : {}),
          },
        ),
      );
      return;
    }
    entries.sort((a, b) => compareCodePoints(a.name, b.name));
    for (const entry of entries) {
      if (isIgnoredName(entry.name)) continue;
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.kind === "dir") {
        await walk(rel, depth + 1);
      } else if (entry.kind === "symlink") {
        const target = await root.symlinkTarget(rel);
        if (!target.inside) {
          diagnostics.push(
            diagnostic(
              "error",
              "FS_SYMLINK_REJECTED",
              `Symlink '${rel}' points outside the workspace root or is broken; skipped`,
              {
                file: rel,
                hint: "Only symlinks to files inside the workspace root are followed.",
              },
            ),
          );
        } else if (target.kind === "dir") {
          diagnostics.push(
            diagnostic(
              "warning",
              "FS_SYMLINK_REJECTED",
              `Symlinked directory '${rel}' is not followed`,
              { file: rel },
            ),
          );
        } else if (target.kind === "file" && isYamlFile(entry.name)) {
          files.push(rel);
        }
      } else if (entry.kind === "file" && isYamlFile(entry.name)) {
        files.push(rel);
      }
      if (files.length > options.maxFiles) {
        files.length = options.maxFiles;
        truncated = true;
        diagnostics.push(
          diagnostic(
            "error",
            "FS_TOO_MANY_FILES",
            `More than ${options.maxFiles} YAML files found; the rest were ignored`,
            {
              hint: "Point the workspace root at a smaller directory.",
            },
          ),
        );
        return;
      }
    }
  }

  await walk("", 0);
  return { files: files.sort(compareCodePoints), diagnostics };
}
