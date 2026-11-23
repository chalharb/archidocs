#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { findWorkspaceRoot, load, nodeFileSystem, serializeBundle } from "../core/index.ts";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { gitHead } from "../git.ts";
import { checkoutSource, createServer } from "../mcp/index.ts";
import { exitCodeFor, formatIssues, formats, formatText, type Format } from "./format.ts";

/** Exit codes: 0 no errors, 1 errors found (or any warning with `--strict`), 2 could not run. */
const OK = 0;
const FOUND_ERRORS = 1;
const COULD_NOT_RUN = 2;

class UsageError extends Error {}

const usage = `Usage:
  archidocs check [--format text|json|github] [--strict]
  archidocs build --bundle-only [--out <dir>]
  archidocs mcp [--workspace <dir>] [--viewer-url <url>]
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "check") {
    const { values } = parseArgs({
      args: rest,
      options: { format: { type: "string", default: "text" }, strict: { type: "boolean", default: false } },
      strict: true,
    });
    const format = values.format as Format;
    if (!formats.includes(format)) throw new UsageError(`Unknown format "${values.format}"; use ${formats.join(", ")}.`);
    const { issues } = await loadFromCwd();
    process.stdout.write(formatIssues(issues, format, { color: useColor() }));
    return exitCodeFor(issues, { strict: values.strict });
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
      process.stdout.write(formatText(issues, { color: useColor() }));
      process.stderr.write("Not writing the Bundle: the Workspace has errors.\n");
      return FOUND_ERRORS;
    }
    const out = resolve(values.out);
    await mkdir(out, { recursive: true });
    await writeFile(join(out, "workspace.bundle.json"), serializeBundle(bundle));
    process.stdout.write(`Wrote ${join(values.out, "workspace.bundle.json")}\n`);
    return OK;
  }
  if (command === "mcp") {
    const { values } = parseArgs({
      args: rest,
      options: { workspace: { type: "string" }, "viewer-url": { type: "string" } },
      strict: true,
    });
    const viewerUrl = values["viewer-url"];
    if (viewerUrl !== undefined && !URL.canParse(viewerUrl)) throw new UsageError(`--viewer-url "${viewerUrl}" is not a URL.`);
    const root = await workspaceRoot(values.workspace === undefined ? process.cwd() : resolve(values.workspace));
    const source = checkoutSource({ root });
    // stdout carries the protocol; the server runs until the client closes stdin.
    serveStdio(() => createServer({ source, ...(viewerUrl === undefined ? {} : { viewerUrl }) }));
    return OK;
  }
  throw new UsageError(command ? `Unknown command "${command}".` : "No command given.");
}

/** Colour only on a terminal; `NO_COLOR` turns it off and `FORCE_COLOR` on. */
function useColor(): boolean {
  const { NO_COLOR, FORCE_COLOR } = process.env;
  if (NO_COLOR) return false;
  if (FORCE_COLOR !== undefined) return FORCE_COLOR !== "0";
  return process.stdout.isTTY === true;
}

async function workspaceRoot(start: string): Promise<string> {
  const root = await findWorkspaceRoot(nodeFileSystem(), start);
  if (!root) throw new UsageError("No workspace.yaml found in this folder, its archidocs/ folder, or any folder above.");
  return root;
}

async function loadFromCwd() {
  const root = await workspaceRoot(process.cwd());
  const { commit, builtAt } = await gitHead(root);
  return load({ fs: nodeFileSystem(), root, commit, builtAt });
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
