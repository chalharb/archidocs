import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Runs git in `cwd` and returns stdout; throws with git's own message on failure. */
export async function git(cwd: string, ...args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("git", ["-c", "core.quotePath=false", ...args], { cwd, maxBuffer: 1024 * 1024 * 1024, encoding: "utf8" });
    return stdout;
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(err.stderr?.trim() || err.message, { cause: e });
  }
}

/** HEAD's sha and commit time, so a Bundle built twice at one commit is byte-identical. Both null outside git or before the first commit. */
export async function gitHead(cwd: string): Promise<{ commit: string | null; builtAt: string | null }> {
  try {
    const [commit, builtAt] = (await git(cwd, "log", "-1", "--format=%H %cI")).trim().split(" ");
    return { commit: commit || null, builtAt: builtAt || null };
  } catch {
    return { commit: null, builtAt: null };
  }
}

/** The top folder of the git checkout holding `cwd`, or null outside git. */
export async function gitTopLevel(cwd: string): Promise<string | null> {
  try {
    return (await git(cwd, "rev-parse", "--show-toplevel")).trim() || null;
  } catch {
    return null;
  }
}
