import { cp, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { revisionOf } from "@/server/persistence/revision";
import { tempDir, type TempDir } from "./tmp";

export const SAMPLE_WORKSPACE = path.resolve(
  import.meta.dirname,
  "../../examples/sample-workspace",
);

/** Layout file to omit when a test needs a diagram that has never been saved. */
export const CONTAINERS_LAYOUT = "diagrams/containers.layout.yaml";

/** Copy the sample workspace into a fresh temp directory, minus any `without` paths. */
export async function copySampleWorkspace(options: { without?: string[] } = {}): Promise<TempDir> {
  const t = await tempDir();
  await cp(SAMPLE_WORKSPACE, t.dir, { recursive: true });
  for (const rel of options.without ?? []) await rm(path.join(t.dir, rel));
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
