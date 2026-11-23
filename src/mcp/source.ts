import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { load, nodeFileSystem, type Issue } from "../core/index.ts";
import { gitHead } from "../git.ts";
import type { Bundle } from "../schema/bundle.ts";

/** The Bundle the server answers from, with the issues Load found building it. */
export interface Snapshot {
  bundle: Bundle;
  issues: Issue[];
}

/**
 * Where the server reads the Workspace from. One source per server process,
 * set at startup. Only the checkout source exists so far; a Bundle file or
 * URL source comes later.
 */
export interface Source {
  readonly kind: "checkout";
  /** The Workspace root: the folder holding `workspace.yaml`. */
  readonly root: string;
  readonly writesAllowed: boolean;
  /** The current Bundle, rebuilt first if the Workspace's files or HEAD changed since the last call. */
  snapshot(): Promise<Snapshot>;
}

/**
 * A local checkout: the Bundle is built in memory and rebuilt when a file
 * under the Workspace root changes or HEAD moves. Change is detected per
 * call from every model file's mtime and size, so an edit is seen by the very
 * next call with no watcher to start or stop.
 */
export function checkoutSource({ root }: { root: string }): Source {
  let cached: { key: string; snapshot: Snapshot } | undefined;
  return {
    kind: "checkout",
    root,
    writesAllowed: false,
    async snapshot() {
      const [files, head] = await Promise.all([fingerprint(root), gitHead(root)]);
      const key = `${head.commit}\n${head.builtAt}\n${files}`;
      if (cached?.key !== key) {
        cached = { key, snapshot: await load({ fs: nodeFileSystem(), root, commit: head.commit, builtAt: head.builtAt }) };
      }
      return cached.snapshot;
    },
  };
}

/** Path, mtime and size of every `.yaml` file Load would read, in a stable order. */
async function fingerprint(root: string): Promise<string> {
  const lines: string[] = [];
  const dirs = [root];
  for (let i = 0; i < dirs.length; i++) {
    for (const entry of await readdir(dirs[i]!, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(dirs[i]!, entry.name);
      if (entry.isDirectory()) dirs.push(path);
      else if (entry.name.endsWith(".yaml")) {
        const s = await stat(path);
        lines.push(`${path}\0${s.mtimeMs}\0${s.size}`);
      }
    }
  }
  return lines.sort().join("\n");
}
