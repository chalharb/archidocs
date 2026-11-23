import { dirname, sep } from "node:path";
import type { DirEntry, FileSystem } from "../core/fs.ts";

/**
 * `base` with some files replaced or added in memory, so Load can check a
 * Workspace as it would be after an edit without anything touching disk.
 * Folders that only the overlay's new files live in are listed too.
 */
export function overlayFileSystem(base: FileSystem, files: ReadonlyMap<string, string>): FileSystem {
  const inOverlayDir = (dir: string) => [...files.keys()].some((p) => p.startsWith(dir + sep));
  return {
    readFile: async (path) => files.get(path) ?? base.readFile(path),
    exists: async (path) => files.has(path) || inOverlayDir(path) || base.exists(path),
    readDir: async (path) => {
      const entries = new Map<string, DirEntry>();
      if (await base.exists(path)) for (const e of await base.readDir(path)) entries.set(e.name, e);
      for (const file of files.keys()) {
        if (!file.startsWith(path + sep)) continue;
        const [name, ...more] = file.slice(path.length + 1).split(sep);
        entries.set(name!, { name: name!, isDirectory: more.length > 0 || dirname(file) !== path });
      }
      return [...entries.values()];
    },
  };
}
