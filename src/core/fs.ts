import { readdir, readFile, stat } from "node:fs/promises";

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

/**
 * The file system the core engine reads a Workspace through. Paths are
 * absolute, in the host's own syntax. Swapping this lets Load read an
 * in-memory overlay or a git commit instead of the working tree.
 */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
}

export function nodeFileSystem(): FileSystem {
  return {
    readFile: (path) => readFile(path, "utf8"),
    readDir: async (path) =>
      (await readdir(path, { withFileTypes: true })).map((d) => ({ name: d.name, isDirectory: d.isDirectory() })),
    exists: async (path) => {
      try {
        await stat(path);
        return true;
      } catch {
        return false;
      }
    },
  };
}
