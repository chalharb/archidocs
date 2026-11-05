/**
 * Atomic file replacement (RELI-08, RELI-12): write a temporary file in the
 * target's directory, fsync it, then rename over the target. If any step fails
 * the temporary file is removed and the original file is left untouched.
 */
import { randomBytes } from "node:crypto";
import { constants, promises as fsp } from "node:fs";
import path from "node:path";

/** Low-level operations, injectable for failure-injection tests. */
export interface AtomicWriteOps {
  writeTemp(tempPath: string, data: string, mode: number): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(target: string): Promise<void>;
  fileMode(target: string): Promise<number | undefined>;
  syncDir(dir: string): Promise<void>;
}

export const nodeAtomicWriteOps: AtomicWriteOps = {
  async writeTemp(tempPath, data, mode) {
    // 'wx' + O_NOFOLLOW: never reuse or follow an existing path.
    const handle = await fsp.open(
      tempPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      mode,
    );
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  rename: (from, to) => fsp.rename(from, to),
  unlink: (target) => fsp.unlink(target),
  async fileMode(target) {
    try {
      return (await fsp.lstat(target)).mode & 0o777;
    } catch {
      return undefined;
    }
  },
  async syncDir(dir) {
    let handle: fsp.FileHandle | undefined;
    try {
      handle = await fsp.open(dir, constants.O_RDONLY);
      await handle.sync();
    } catch {
      // Directory fsync is best-effort; not supported on every platform.
    } finally {
      await handle?.close();
    }
  },
};

export function tempPathFor(target: string): string {
  const dir = path.dirname(target);
  return path.join(
    dir,
    `.${path.basename(target)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
}

export async function atomicWriteFile(
  target: string,
  data: string,
  ops: AtomicWriteOps = nodeAtomicWriteOps,
): Promise<void> {
  const temp = tempPathFor(target);
  const mode = (await ops.fileMode(target)) ?? 0o644;
  try {
    await ops.writeTemp(temp, data, mode);
    await ops.rename(temp, target);
  } catch (err) {
    await ops.unlink(temp).catch(() => undefined);
    throw err;
  }
  await ops.syncDir(path.dirname(target));
}
