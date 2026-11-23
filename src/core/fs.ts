import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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

/** A FileSystem the YAML writer can also write through. `writeFile` creates missing folders. */
export interface WritableFileSystem extends FileSystem {
  writeFile(path: string, text: string): Promise<void>;
}

export function nodeFileSystem(): WritableFileSystem {
  return {
    writeFile: async (path, text) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    },
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
