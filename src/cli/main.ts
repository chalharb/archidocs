#!/usr/bin/env node
import { existsSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { findWorkspaceRoot, load, nodeFileSystem, resolveView, serializeBundle, type ResolvedView } from "../core/index.ts";
import { directions, layoutView, renderSvg, type Direction } from "../render/index.ts";
import { renderPngInNode } from "../render/node.ts";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { gitHead, gitTopLevel } from "../git.ts";
import { bundleSource, checkoutSource, createServer, DEFAULT_PORT, serveHttp } from "../mcp/index.ts";
import { exitCodeFor, formatIssues, formats, formatText, type Format } from "./format.ts";

/** Exit codes: 0 no errors, 1 errors found (or any warning with `--strict`), 2 could not run. */
const OK = 0;
const FOUND_ERRORS = 1;
const COULD_NOT_RUN = 2;

class UsageError extends Error {}

/**
 * The prebuilt viewer, which `build --out` copies as is. The CLI runs from
 * dist/cli/ when installed and from src/cli/ in this repo; both sit two
 * levels below the package root, whose dist/viewer/ holds the viewer.
 */
const VIEWER_DIR = fileURLToPath(new URL("../../dist/viewer/", import.meta.url));

const usage = `Usage:
  archidocs check [--format text|json|github] [--strict]
  archidocs build [--out <dir>] [--bundle-only]
  archidocs export <view-id> [--format svg|png] [--out <file>] [--direction TB|BT|LR|RL]
  archidocs export --all-saved --out <dir> [--format svg|png] [--direction TB|BT|LR|RL]
  archidocs mcp [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>]
                [--http [--host <loopback>] [--port <n>] [--allow-writes]]
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
    const { bundle, issues } = await loadFromCwd();
    if (issues.some((i) => i.severity === "error")) {
      process.stdout.write(formatText(issues, { color: useColor() }));
      process.stderr.write(`Not writing the ${values["bundle-only"] ? "Bundle" : "site"}: the Workspace has errors.\n`);
      return FOUND_ERRORS;
    }
    const out = resolve(values.out);
    if (!values["bundle-only"]) {
      if (!existsSync(join(VIEWER_DIR, "index.html"))) throw new Error(`The viewer is not built (no ${VIEWER_DIR}); run \`pnpm build\` first.`);
      await cp(VIEWER_DIR, out, { recursive: true });
    }
    await mkdir(out, { recursive: true });
    await writeFile(join(out, "workspace.bundle.json"), serializeBundle(bundle));
    process.stdout.write(values["bundle-only"] ? `Wrote ${join(values.out, "workspace.bundle.json")}\n` : `Wrote the site to ${values.out}\n`);
    return OK;
  }
  if (command === "export") {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { format: { type: "string", default: "svg" }, out: { type: "string" }, direction: { type: "string" }, "all-saved": { type: "boolean", default: false } },
      allowPositionals: true,
      strict: true,
    });
    const allSaved = values["all-saved"];
    const [viewId, ...extra] = positionals;
    if (allSaved && viewId !== undefined) throw new UsageError("Give a View or --all-saved, not both.");
    if (allSaved && values.out === undefined) throw new UsageError("--all-saved needs --out <dir> for the pictures.");
    if (!allSaved && viewId === undefined) throw new UsageError("Give the View to export, such as c1 or c2/<system>, or --all-saved.");
    if (extra.length > 0) throw new UsageError(`Export one View at a time; got ${positionals.join(", ")}.`);
    const format = values.format;
    if (format !== "svg" && format !== "png") throw new UsageError(`Unknown format "${format}"; use svg or png.`);
    const direction = values.direction as Direction | undefined;
    if (direction !== undefined && !directions.includes(direction)) throw new UsageError(`Unknown direction "${direction}"; use ${directions.join(", ")}.`);
    const root = await workspaceRoot(process.cwd());
    const { bundle, issues } = await loadFromCwd();
    if (issues.some((i) => i.severity === "error")) {
      process.stdout.write(formatText(issues, { color: useColor() }));
      process.stderr.write("Not exporting: the Workspace has errors.\n");
      return FOUND_ERRORS;
    }
    const workspace = basename((await gitTopLevel(root)) ?? root);
    const fileName = (id: string) => `${id.replace(/[/:]/g, "-")}.${format}`;
    /** Lays out and draws one View; `--direction` wins over a Saved View's own. */
    const draw = async (view: ResolvedView, out: string) => {
      const chosen = direction ?? view.direction;
      const layout = await layoutView(view, chosen === undefined ? {} : { direction: chosen });
      const svg = renderSvg({ bundle, view, layout, source: { workspace, commit: bundle.commit, date: bundle.builtAt } });
      await writeFile(resolve(out), format === "svg" ? svg : await renderPngInNode(svg));
      process.stdout.write(`Wrote ${out}\n`);
    };

    if (allSaved) {
      await mkdir(resolve(values.out!), { recursive: true });
      for (const saved of bundle.views) {
        const view = resolveView(bundle, saved.id);
        if (!view) {
          process.stderr.write(`Skipped ${saved.id}: Deployment Views can't be exported yet.\n`);
          continue;
        }
        await draw(view, join(values.out!, fileName(saved.id)));
      }
      return OK;
    }
    if (bundle.views.some((v) => v.id === viewId && v.level === "deployment")) throw new UsageError(`"${viewId}" is a Deployment View, which can't be exported yet.`);
    const view = resolveView(bundle, viewId!);
    if (!view) throw new UsageError(`Unknown View "${viewId}"; Views are c1, c2, c2/<system>, c3/<service with Components> and Saved Views (project:view-id).`);
    await draw(view, values.out ?? fileName(viewId!));
    return OK;
  }
  if (command === "mcp") {
    const { values } = parseArgs({
      args: rest,
      options: {
        workspace: { type: "string" },
        bundle: { type: "string" },
        "viewer-url": { type: "string" },
        http: { type: "boolean", default: false },
        host: { type: "string" },
        port: { type: "string" },
        "allow-writes": { type: "boolean", default: false },
      },
      strict: true,
    });
    const viewerUrl = values["viewer-url"];
    if (viewerUrl !== undefined && !URL.canParse(viewerUrl)) throw new UsageError(`--viewer-url "${viewerUrl}" is not a URL.`);
    if (values.workspace !== undefined && values.bundle !== undefined) throw new UsageError("Give --workspace or --bundle, not both.");
    if (!values.http && values["allow-writes"]) throw new UsageError("--allow-writes only applies with --http; over stdio a checkout already takes writes.");
    if (!values.http && (values.host !== undefined || values.port !== undefined)) throw new UsageError("--host and --port only apply with --http.");
    const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`--port "${values.port}" is not a port.`);

    const source =
      values.bundle !== undefined
        ? bundleSource({ location: values.bundle })
        : checkoutSource({ root: await workspaceRoot(values.workspace === undefined ? process.cwd() : resolve(values.workspace)) });
    const options = { source, ...(viewerUrl === undefined ? {} : { viewerUrl }) };
    if (values.http) {
      const http = await serveHttp({ ...options, port, allowWrites: values["allow-writes"], ...(values.host === undefined ? {} : { host: values.host }) });
      process.stderr.write(`Archidocs MCP server on ${http.url} (writes ${values["allow-writes"] && source.writesAllowed ? "allowed" : "off"})\n`);
      return OK;
    }
    // stdout carries the protocol; the server runs until the client closes stdin.
    serveStdio(() => createServer(options));
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
