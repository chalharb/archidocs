import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { load, nodeFileSystem, type Files } from "../../src/core/index.ts";

export type { Files };

/**
 * Writes a fixture Workspace into a fresh temp git repo (no commits), under `archidocs/`
 * (the default Workspace root), and returns both folders.
 */
export async function writeWorkspace(files: Files): Promise<{ repoRoot: string; root: string }> {
  const repoRoot = await mkdtemp(join(tmpdir(), "archidocs-"));
  const root = join(repoRoot, "archidocs");
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, text);
  }
  await mkdir(root, { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: repoRoot });
  return { repoRoot, root };
}

/** Writes a fixture Workspace and runs the core engine's Load over it. */
export async function loadWorkspace(files: Files) {
  const { repoRoot, root } = await writeWorkspace(files);
  return load({ fs: nodeFileSystem(), root, repoRoot });
}
