/**
 * The only gateway to files under a configured workspace root (SEC-02, SEC-09).
 *
 * - Paths are workspace-relative; absolute paths, NUL bytes and anything that
 *   resolves outside the root are rejected (SEC-03).
 * - Symlinks: intermediate directory symlinks are never followed. A symlinked
 *   file may be read only if its real target is a regular file inside the same
 *   root. Writes never go through symlinks (SEC-04).
 * - Reads enforce a byte limit before loading content (SEC-06).
 */
import { constants, promises as fsp } from "node:fs";
import path from "node:path";
import { atomicWriteFile, nodeAtomicWriteOps, type AtomicWriteOps } from "./atomic-write";
import { FsError, toFsError } from "./errors";

export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function toPosix(rel: string): string {
  return rel.split(path.sep).join("/");
}

export class WorkspaceRoot {
  private constructor(
    /** Real (symlink-free) absolute path of the root. */
    readonly realPath: string,
    private readonly ops: AtomicWriteOps,
  ) {}

  static async open(
    rootPath: string,
    ops: AtomicWriteOps = nodeAtomicWriteOps,
  ): Promise<WorkspaceRoot> {
    let real: string;
    try {
      real = await fsp.realpath(path.resolve(rootPath));
    } catch (err) {
      throw toFsError(err, rootPath);
    }
    const stat = await fsp.stat(real);
    if (!stat.isDirectory())
      throw new FsError("NOT_A_FILE", `Workspace root is not a directory: ${rootPath}`, rootPath);
    return new WorkspaceRoot(real, ops);
  }

  /** Lexically resolve a workspace-relative path; no filesystem access. */
  lexical(rel: string): string {
    if (typeof rel !== "string" || rel.includes("\0")) {
      throw new FsError("INVALID_PATH", "Invalid path", String(rel));
    }
    if (path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.startsWith("\\")) {
      throw new FsError("OUTSIDE_ROOT", `Absolute paths are not allowed: ${rel}`, rel);
    }
    const abs = path.resolve(this.realPath, rel);
    if (!isInside(this.realPath, abs)) {
      throw new FsError("OUTSIDE_ROOT", `Path is outside the workspace root: ${rel}`, rel);
    }
    return abs;
  }

  /**
   * Resolve a path and verify no component is an unsafe symlink.
   * Returns the absolute path to operate on (the real target for a symlinked file read).
   */
  async resolve(rel: string, intent: "read" | "write"): Promise<string> {
    const abs = this.lexical(rel);
    const parts = path.relative(this.realPath, abs).split(path.sep).filter(Boolean);
    let current = this.realPath;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]!);
      let stat;
      try {
        stat = await fsp.lstat(current);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return abs; // rest does not exist yet
        throw toFsError(err, rel);
      }
      if (!stat.isSymbolicLink()) continue;
      const isLast = i === parts.length - 1;
      if (!isLast) {
        throw new FsError(
          "SYMLINK_REJECTED",
          `Symlinked directories are not followed: ${rel}`,
          rel,
        );
      }
      if (intent === "write") {
        throw new FsError("SYMLINK_REJECTED", `Refusing to write through a symlink: ${rel}`, rel);
      }
      let target: string;
      try {
        target = await fsp.realpath(current);
      } catch (err) {
        throw toFsError(err, rel);
      }
      if (!isInside(this.realPath, target)) {
        throw new FsError(
          "SYMLINK_REJECTED",
          `Symlink points outside the workspace root: ${rel}`,
          rel,
        );
      }
      return target;
    }
    return abs;
  }

  /** Read a UTF-8 file, enforcing `maxBytes` before loading it. */
  async readFile(rel: string, maxBytes: number): Promise<string> {
    return (await this.readBytes(rel, maxBytes)).toString("utf8");
  }

  /**
   * Read a file's raw bytes, enforcing `maxBytes` before loading it.
   * `verifyTarget` runs on the resolved path (the real target of an in-root
   * file symlink) before the file is opened, so callers can apply their own
   * rules to what is actually read.
   */
  async readBytes(
    rel: string,
    maxBytes: number,
    verifyTarget?: (target: string) => void,
  ): Promise<Buffer> {
    const target = await this.resolve(rel, "read");
    verifyTarget?.(target);
    let handle: fsp.FileHandle | undefined;
    try {
      handle = await fsp.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile()) throw new FsError("NOT_A_FILE", `Not a regular file: ${rel}`, rel);
      if (stat.size > maxBytes) {
        throw new FsError(
          "TOO_LARGE",
          `File is ${stat.size} bytes; the limit is ${maxBytes} bytes`,
          rel,
        );
      }
      return await handle.readFile();
    } catch (err) {
      throw toFsError(err, rel);
    } finally {
      await handle?.close();
    }
  }

  /** Read a file, or return null if it does not exist. */
  async readFileIfExists(rel: string, maxBytes: number): Promise<string | null> {
    try {
      return await this.readFile(rel, maxBytes);
    } catch (err) {
      if (err instanceof FsError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }

  /** Atomically replace a file (RELI-08). The parent directory must exist. */
  async writeFileAtomic(rel: string, content: string): Promise<void> {
    const target = await this.resolve(rel, "write");
    try {
      await atomicWriteFile(target, content, this.ops);
    } catch (err) {
      throw toFsError(err, rel);
    }
  }

  /** Create a directory (and parents) inside the root without following symlinks. */
  async ensureDir(rel: string): Promise<void> {
    const abs = await this.resolve(rel, "write");
    try {
      await fsp.mkdir(abs, { recursive: true });
    } catch (err) {
      throw toFsError(err, rel);
    }
    // Re-check after creation in case a component was swapped for a symlink.
    await this.resolve(rel, "write");
  }

  async remove(rel: string): Promise<void> {
    const target = await this.resolve(rel, "write");
    try {
      await fsp.unlink(target);
    } catch (err) {
      const fsErr = toFsError(err, rel);
      if (fsErr.code !== "NOT_FOUND") throw fsErr;
    }
  }

  async listDir(
    rel: string,
  ): Promise<Array<{ name: string; kind: "file" | "dir" | "symlink" | "other" }>> {
    const abs = await this.resolve(rel, "read");
    try {
      const entries = await fsp.readdir(abs, { withFileTypes: true });
      return entries.map((e) => ({
        name: e.name,
        kind: e.isSymbolicLink()
          ? "symlink"
          : e.isDirectory()
            ? "dir"
            : e.isFile()
              ? "file"
              : "other",
      }));
    } catch (err) {
      throw toFsError(err, rel);
    }
  }

  /** Classify a symlink found during discovery. */
  async symlinkTarget(
    rel: string,
  ): Promise<{ inside: boolean; kind: "file" | "dir" | "other" | "broken" }> {
    const abs = this.lexical(rel);
    try {
      const real = await fsp.realpath(abs);
      const stat = await fsp.stat(real);
      return {
        inside: isInside(this.realPath, real),
        kind: stat.isFile() ? "file" : stat.isDirectory() ? "dir" : "other",
      };
    } catch {
      return { inside: false, kind: "broken" };
    }
  }
}
