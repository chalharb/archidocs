import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

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

/** A FileSystem the YAML writer can also write through. `writeFile` creates missing folders and replaces a file whole, never leaving it half written. */
export interface WritableFileSystem extends FileSystem {
  writeFile(path: string, text: string): Promise<void>;
}

export function nodeFileSystem(): WritableFileSystem {
  return {
    writeFile: async (path, text) => {
      await mkdir(dirname(path), { recursive: true });
      // A hidden temp file beside it, which Load skips, then a rename over it.
      const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
      try {
        await writeFile(temp, text);
        await rename(temp, path);
      } catch (error) {
        await rm(temp, { force: true });
        throw error;
      }
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
