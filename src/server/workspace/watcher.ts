/**
 * File watching (RELI-01): batch filesystem events under a workspace root and
 * report them after a quiet period. Hidden paths (e.g. .archidoc drafts, .git)
 * and node_modules are ignored; only YAML and Markdown files and directory changes count.
 */
import { watch, type FSWatcher } from "chokidar";
import path from "node:path";
import { isIgnoredName, isWorkspaceFile } from "../fs/discovery";
import { toPosix } from "../fs/workspace-root";

export interface WorkspaceWatcher {
  ready: Promise<void>;
  close(): Promise<void>;
}

export function isRelevantPath(rootReal: string, absPath: string): boolean {
  const rel = path.relative(rootReal, absPath);
  if (rel === "" || rel.startsWith("..")) return false;
  return !rel.split(path.sep).some(isIgnoredName);
}

export function watchWorkspace(
  rootReal: string,
  onChange: (changedPaths: string[]) => void,
  options: { debounceMs?: number; usePolling?: boolean } = {},
): WorkspaceWatcher {
  const debounceMs = options.debounceMs ?? 150;
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const watcher: FSWatcher = watch(rootReal, {
    ignoreInitial: true,
    followSymlinks: false,
    usePolling: options.usePolling ?? false,
    interval: 50,
    ignored: (p: string) => p !== rootReal && !isRelevantPath(rootReal, p),
  });

  const flush = () => {
    timer = undefined;
    const paths = [...pending].sort();
    pending.clear();
    if (paths.length > 0) onChange(paths);
  };

  watcher.on("all", (event, absPath) => {
    const isDirEvent = event === "addDir" || event === "unlinkDir";
    if (!isDirEvent && !isWorkspaceFile(absPath)) return;
    pending.add(toPosix(path.relative(rootReal, absPath)));
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  });

  const ready = new Promise<void>((resolve) => watcher.once("ready", () => resolve()));

  return {
    ready,
    async close() {
      if (timer) clearTimeout(timer);
      pending.clear();
      await watcher.close();
    },
  };
}
