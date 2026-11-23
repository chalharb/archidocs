import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** HEAD's sha and commit time, so a Bundle built twice at one commit is byte-identical. Both null outside git or before the first commit. */
export async function gitHead(cwd: string): Promise<{ commit: string | null; builtAt: string | null }> {
  try {
    const { stdout } = await promisify(execFile)("git", ["log", "-1", "--format=%H %cI"], { cwd });
    const [commit, builtAt] = stdout.trim().split(" ");
    return { commit: commit || null, builtAt: builtAt || null };
  } catch {
    return { commit: null, builtAt: null };
  }
}
