#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { findWorkspaceRoot, load, nodeFileSystem, serializeBundle } from "../core/index.ts";
import { formatText } from "./format.ts";

/** Exit codes: 0 no errors, 1 errors found, 2 could not run. */
const OK = 0;
const FOUND_ERRORS = 1;
const COULD_NOT_RUN = 2;

class UsageError extends Error {}

const usage = `Usage:
  archidocs check
  archidocs build --bundle-only [--out <dir>]
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "check") {
    parseArgs({ args: rest, options: {}, strict: true });
    const { issues } = await loadFromCwd();
    process.stdout.write(formatText(issues));
    return issues.some((i) => i.severity === "error") ? FOUND_ERRORS : OK;
  }
  if (command === "build") {
    const { values } = parseArgs({
      args: rest,
      options: { "bundle-only": { type: "boolean" }, out: { type: "string", default: "dist" } },
      strict: true,
    });
    if (!values["bundle-only"]) throw new UsageError("Only `build --bundle-only` is available so far.");
    const { bundle, issues } = await loadFromCwd();
    if (issues.some((i) => i.severity === "error")) {
      process.stdout.write(formatText(issues));
      process.stderr.write("Not writing the Bundle: the Workspace has errors.\n");
      return FOUND_ERRORS;
    }
    const out = resolve(values.out);
    await mkdir(out, { recursive: true });
    await writeFile(join(out, "workspace.bundle.json"), serializeBundle(bundle));
    process.stdout.write(`Wrote ${join(values.out, "workspace.bundle.json")}\n`);
    return OK;
  }
  throw new UsageError(command ? `Unknown command "${command}".` : "No command given.");
}

async function loadFromCwd() {
  const fs = nodeFileSystem();
  const root = await findWorkspaceRoot(fs, process.cwd());
  if (!root) throw new UsageError("No workspace.yaml found in this folder, its archidocs/ folder, or any folder above.");
  const { commit, builtAt } = await gitHead(root);
  return load({ fs, root, commit, builtAt });
}

/** HEAD's sha and commit time, so a Bundle built twice at one commit is byte-identical. */
async function gitHead(cwd: string): Promise<{ commit: string | null; builtAt: string | null }> {
  try {
    const { stdout } = await promisify(execFile)("git", ["log", "-1", "--format=%H %cI"], { cwd });
    const [commit, builtAt] = stdout.trim().split(" ");
    return { commit: commit || null, builtAt: builtAt || null };
  } catch {
    return { commit: null, builtAt: null };
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`archidocs: ${message}\n`);
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")) process.stderr.write(usage);
    process.exitCode = COULD_NOT_RUN;
  },
);
