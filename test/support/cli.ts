import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { run } from "../../src/cli/run.ts";

const cli = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));

/** Splits `archidocs`'s rest arguments into the extra environment variables, if any, and the CLI's arguments. */
function split(rest: [Record<string, string>, ...string[]] | string[]): [Record<string, string>, string[]] {
  return typeof rest[0] === "object" ? [rest[0], rest.slice(1) as string[]] : [{}, rest as string[]];
}

/** Runs the CLI in-process in `cwd`, optionally with extra environment variables first; never throws on a non-zero exit. */
export async function archidocs(cwd: string, ...rest: [Record<string, string>, ...string[]] | string[]) {
  const [env, args] = split(rest);
  let stdout = "";
  let stderr = "";
  const code = await run(args, {
    cwd,
    env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: undefined, ...env },
    stdout: { write: (chunk: string) => (stdout += chunk) },
    stderr: { write: (chunk: string) => (stderr += chunk) },
  });
  return { code, stdout, stderr };
}

/** Runs the real CLI as a child process in `cwd`, like `archidocs`; for the few tests of the binary itself. */
export async function archidocsBinary(cwd: string, ...rest: [Record<string, string>, ...string[]] | string[]) {
  const [env, args] = split(rest);
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
