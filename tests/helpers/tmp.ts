import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempDir {
  dir: string;
  write(rel: string, content: string): Promise<string>;
  cleanup(): Promise<void>;
}

/** Create a temporary directory populated with `files` (relative path -> content). */
export async function tempDir(files: Record<string, string> = {}): Promise<TempDir> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "archidoc-test-"));
  const write = async (rel: string, content: string) => {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
    return abs;
  };
  for (const [rel, content] of Object.entries(files)) await write(rel, content);
  return { dir, write, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** Poll until `check` passes or the timeout elapses. */
export async function waitFor<T>(
  check: () => T | Promise<T>,
  timeoutMs = 5000,
  intervalMs = 25,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw lastError;
}
