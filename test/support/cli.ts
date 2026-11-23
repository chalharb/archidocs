import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const cli = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));

/** Runs the real CLI in `cwd`, optionally with extra environment variables first; never throws on a non-zero exit. */
export async function archidocs(cwd: string, ...rest: [Record<string, string>, ...string[]] | string[]) {
  const [env, args] = typeof rest[0] === "object" ? [rest[0], rest.slice(1) as string[]] : [{}, rest as string[]];
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [cli, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: undefined, ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}
