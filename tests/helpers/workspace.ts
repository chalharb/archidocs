import { cp, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { revisionOf } from "@/server/persistence/revision";
import { tempDir, type TempDir } from "./tmp";

export const SAMPLE_WORKSPACE = path.resolve(
  import.meta.dirname,
  "../../examples/sample-workspace",
);

/** Copy the sample workspace into a fresh temp directory. */
export async function copySampleWorkspace(): Promise<TempDir> {
  const t = await tempDir();
  await cp(SAMPLE_WORKSPACE, t.dir, { recursive: true });
  return t;
}

/** Content hashes of every non-hidden file under `dir`, keyed by relative path. */
export async function hashTree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const abs = path.join(e.parentPath, e.name);
    const rel = path.relative(dir, abs);
    if (rel.split(path.sep).some((p) => p.startsWith("."))) continue;
    out[rel] = revisionOf(await readFile(abs, "utf8"));
  }
  return out;
}
