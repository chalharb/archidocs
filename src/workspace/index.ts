import { readdir, realpath, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { findWorkspaceRoot, load, nodeFileSystem, type LoadResult } from "../core/index.ts";
import { isSkippedName, isWorkspaceFile } from "../core/workspace-files.ts";
import { gitHead, gitTopLevel } from "../git.ts";
import { history, type History } from "../history/index.ts";

export { isWorkspaceFile } from "../core/workspace-files.ts";

/** The git repo a Checkout is in: the Workspace root with symlinks resolved, git's top level, and the History handle over both. */
export interface Repo {
  /** The Workspace root, realpath'd. */
  realRoot: string;
  /** `git rev-parse --show-toplevel` from `realRoot`. */
  repoRoot: string;
  history: History;
}

/**
 * A Workspace root on disk, possibly inside a git repo: what the CLI, dev and
 * the MCP server read a Workspace from. Git facts are looked up lazily; HEAD
 * and the files are read on every call, so a commit or an edit is seen.
 */
export interface Checkout {
  /** The Workspace root as given or found, not realpath'd: what users see. */
  readonly root: string;
  /** The git repo, or undefined outside git. Looked up once. */
  repo(): Promise<Repo | undefined>;
  /** How the Workspace is named (a picture's source line, a site's `site.json`): its repo's folder, else the root's. */
  name(): Promise<string>;
  /** HEAD's sha and commit time, read on every call; both null outside git or before the first commit. */
  head(): Promise<{ commit: string | null; builtAt: string | null }>;
  /** The working tree's Bundle and issues, recorded at HEAD. */
  load(): Promise<LoadResult>;
  /** Path, mtime and size of every Workspace file, in a stable order: changes when a Workspace file does. */
  fingerprint(): Promise<string>;
}

/** A Checkout at a known Workspace root (the folder holding `workspace.yaml`). */
export function checkoutAt(root: string): Checkout {
  let repo: Promise<Repo | undefined> | undefined;
  const checkout: Checkout = {
    root,
    repo: () =>
      (repo ??= (async () => {
        // Resolve first: `history()` and `load` make paths relative to git's top level, which git resolves.
        const realRoot = await realpath(root);
        const repoRoot = await gitTopLevel(realRoot);
        return repoRoot ? { realRoot, repoRoot, history: history(repoRoot, realRoot) } : undefined;
      })()),
    name: async () => basename((await checkout.repo())?.repoRoot ?? root),
    head: () => gitHead(root),
    load: async () => {
      const [found, { commit, builtAt }] = await Promise.all([checkout.repo(), checkout.head()]);
      const fs = nodeFileSystem();
      return found ? load({ fs, root: found.realRoot, repoRoot: found.repoRoot, commit, builtAt }) : load({ fs, root, commit, builtAt });
    },
    fingerprint: () => fingerprint(root),
  };
  return checkout;
}

/** The Checkout whose Workspace holds `start`: walking up from it, a folder holding `workspace.yaml` or its `archidocs/` one. Undefined when there is none. */
export async function findCheckout(start: string): Promise<Checkout | undefined> {
  const root = await findWorkspaceRoot(nodeFileSystem(), start);
  return root === undefined ? undefined : checkoutAt(root);
}

async function fingerprint(root: string): Promise<string> {
  const lines: string[] = [];
  const dirs = [root];
  for (let i = 0; i < dirs.length; i++) {
    for (const entry of await readdir(dirs[i]!, { withFileTypes: true })) {
      if (isSkippedName(entry.name)) continue;
      const path = join(dirs[i]!, entry.name);
      if (entry.isDirectory()) dirs.push(path);
      else if (isWorkspaceFile(relative(root, path))) {
        const s = await stat(path);
        lines.push(`${path}\0${s.mtimeMs}\0${s.size}`);
      }
    }
  }
  return lines.sort().join("\n");
}
