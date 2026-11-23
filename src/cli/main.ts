#!/usr/bin/env node
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Bundle } from "../schema/bundle.ts";
import { findWorkspaceRoot, load, nodeFileSystem, resolveDynamicView, resolveView, serializeBundle, type ResolvedDynamicView, type ResolvedView } from "../core/index.ts";
import { directions, layoutView, renderSequenceSvg, renderSvg, type Direction } from "../render/index.ts";
import { renderPngInNode } from "../render/node.ts";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { gitHead, gitTopLevel } from "../git.ts";
import { bundleSource, checkoutSource, createServer, DEFAULT_PORT, serveHttp } from "../mcp/index.ts";
import { authoringGuide } from "../guide/index.ts";
import { init } from "./init.ts";
import { exitCodeFor, formatIssues, formats, formatText, type Format } from "./format.ts";
import { diff } from "../core/index.ts";
import { bundleAt, buildHistory, DEFAULT_KEEP, defaultBaseBranch, history, previewSides, publishHistory, publishPreview, resolvePoint, type History, type PreviewSides } from "../history/index.ts";
import { SCHEMA_VERSION } from "../schema/bundle.ts";
import { diffFormats, formatDiff, type DiffFormat, type DiffSide } from "./diff-format.ts";

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

/** The package's own package.json, two levels up from dist/cli/ or src/cli/ like the viewer. */
const PACKAGE_JSON = fileURLToPath(new URL("../../package.json", import.meta.url));

const usage = `Usage:
  archidocs version [--format text|json]
  archidocs init [--skill [--workspace <dir>]]
  archidocs guide [topic]
  archidocs check [--format text|json|github] [--strict]
  archidocs build [--out <dir>] [--bundle-only] [--keep <n|all>]
  archidocs build --preview [--base <branch>] [--out <dir>]
  archidocs export <view-id> [--format svg|png] [--out <file>] [--direction TB|BT|LR|RL]
  archidocs export --all-saved --out <dir> [--format svg|png] [--direction TB|BT|LR|RL]
  archidocs diff <from> [<to>] [--format text|json|markdown]
  archidocs history build [--since <ref|date>]
  archidocs mcp [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>]
                [--http [--host <loopback>] [--port <n>] [--allow-writes]]
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "init") {
    const { values } = parseArgs({ args: rest, options: { skill: { type: "boolean", default: false }, workspace: { type: "string" } }, strict: true });
    if (values.workspace !== undefined && !values.skill) throw new UsageError("--workspace only applies with --skill; without it, init uses or creates this repo's Workspace.");
    const cwd = await realpath(process.cwd());
    const repoRoot = (await gitTopLevel(cwd)) ?? cwd;
    const lines = await init({ repoRoot, cwd, skillOnly: values.skill, ...(values.workspace === undefined ? {} : { workspace: values.workspace }) });
    process.stdout.write(lines.join("\n") + "\n");
    return OK;
  }
  if (command === "version") {
    const { values } = parseArgs({ args: rest, options: { format: { type: "string", default: "text" } }, strict: true });
    if (values.format !== "text" && values.format !== "json") throw new UsageError(`Unknown format "${values.format}"; use text or json.`);
    const { version } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string };
    process.stdout.write(values.format === "json" ? JSON.stringify({ version, schemaVersion: SCHEMA_VERSION }) + "\n" : `archidocs ${version} (Bundle schemaVersion ${SCHEMA_VERSION})\n`);
    return OK;
  }
  if (command === "guide") {
    const { positionals } = parseArgs({ args: rest, options: {}, allowPositionals: true, strict: true });
    if (positionals.length > 1) throw new UsageError(`Give one topic at a time; got ${positionals.join(", ")}.`);
    const guide = await authoringGuide(positionals[0]);
    if (!guide.ok) throw new UsageError(guide.message);
    process.stdout.write(guide.text);
    return OK;
  }
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
      options: {
        "bundle-only": { type: "boolean" },
        out: { type: "string", default: "dist" },
        keep: { type: "string" },
        preview: { type: "boolean", default: false },
        base: { type: "string" },
      },
      strict: true,
    });
    if (values.preview && values.keep !== undefined) throw new UsageError("--keep doesn't apply to --preview, whose site holds just the base and the PR head.");
    if (values.preview && values["bundle-only"]) throw new UsageError("--bundle-only doesn't apply to --preview, which writes a site.");
    if (values.base !== undefined && !values.preview) throw new UsageError("--base only applies with --preview.");
    const keep = values.keep === undefined ? DEFAULT_KEEP : values.keep === "all" ? "all" : Number(values.keep);
    if (keep !== "all" && !(Number.isInteger(keep) && keep >= 0)) throw new UsageError(`--keep "${values.keep}" is not a count or all.`);
    if (values["bundle-only"] && values.keep !== undefined) throw new UsageError("--keep only applies to a site; --bundle-only writes no past Bundles.");
    const { bundle, issues } = await loadFromCwd();
    if (issues.some((i) => i.severity === "error")) {
      process.stdout.write(formatText(issues, { color: useColor() }));
      process.stderr.write(`Not writing the ${values["bundle-only"] ? "Bundle" : "site"}: the Workspace has errors.\n`);
      return FOUND_ERRORS;
    }
    // A preview finds both sides before writing anything, so a missing base writes no site.
    let preview: { h: History; sides: PreviewSides } | undefined;
    if (values.preview) {
      const h = await historyFromCwd();
      preview = { h, sides: await previewSides(h, values.base ?? (await defaultBaseBranch(h.repoRoot))) };
    }
    const out = resolve(values.out);
    if (!values["bundle-only"]) {
      if (!existsSync(join(VIEWER_DIR, "index.html"))) throw new Error(`The viewer is not built (no ${VIEWER_DIR}); run \`pnpm build\` first.`);
      await cp(VIEWER_DIR, out, { recursive: true });
    }
    await mkdir(out, { recursive: true });
    await writeFile(join(out, "workspace.bundle.json"), serializeBundle(bundle));
    if (preview) {
      const { base, baseSha, headSha } = await publishPreview(preview.h, out, preview.sides, bundle);
      process.stdout.write(`Wrote the preview site to ${values.out}: Compare origin/${base} (${baseSha.slice(0, 7)}) → PR (${headSha.slice(0, 7)})\n`);
      return OK;
    }
    if (!values["bundle-only"]) await writeSiteHistory(out, keep);
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
    const source = { workspace, commit: bundle.commit, date: bundle.builtAt };
    const write = async (svg: string, out: string) => {
      await writeFile(resolve(out), format === "svg" ? svg : await renderPngInNode(svg));
      process.stdout.write(`Wrote ${out}\n`);
    };
    /** Lays out and draws one View: a Dynamic View as a sequence chart, any other as a diagram. */
    const draw = async (view: ResolvedView | ResolvedDynamicView, out: string) => {
      if (view.kind === "dynamic") return write(renderSequenceSvg({ bundle, view, source }), out);
      const chosen = direction ?? view.direction;
      const layout = await layoutView(view, chosen === undefined ? {} : { direction: chosen });
      await write(renderSvg({ bundle, view, layout, source }), out);
    };
    const resolveAny = (id: string) => resolveDynamicView(bundle, id) ?? resolveView(bundle, id);

    if (allSaved) {
      await mkdir(resolve(values.out!), { recursive: true });
      for (const saved of bundle.views) {
        const view = resolveAny(saved.id);
        if (view) await draw(view, join(values.out!, fileName(saved.id)));
      }
      return OK;
    }
    const view = resolveAny(viewId!);
    if (!view) throw new UsageError(`Unknown View "${viewId}"; Views are c1, c2, c2/<system>, c3/<service with Components>, deployment/<environment> and Saved Views (project:view-id).`);
    await draw(view, values.out ?? fileName(viewId!));
    return OK;
  }
  if (command === "diff") {
    const { values, positionals } = parseArgs({ args: rest, options: { format: { type: "string", default: "text" } }, allowPositionals: true, strict: true });
    const format = values.format as DiffFormat;
    if (!diffFormats.includes(format)) throw new UsageError(`Unknown format "${values.format}"; use ${diffFormats.join(", ")}.`);
    const [fromPoint, toPoint, ...extra] = positionals;
    if (fromPoint === undefined) throw new UsageError("Give the point to diff from: a ref or a date.");
    if (extra.length > 0) throw new UsageError(`Give at most two points; got ${positionals.join(", ")}.`);
    const h = await historyFromCwd();
    /** A point's Bundle; with no point, the working tree's. */
    const side = async (point: string | undefined): Promise<[DiffSide, Bundle]> => {
      if (point === undefined) return [{ point: "working tree", commit: null }, (await loadFromCwd()).bundle];
      const commit = await resolvePoint(h.repoRoot, point);
      if (!commit) throw new UsageError(`Unknown ref or date "${point}"; a date resolves to the last default-branch commit at or before it.`);
      return [{ point, commit }, (await bundleAt(h, commit)).bundle];
    };
    const [from, before] = await side(fromPoint);
    const [to, after] = await side(toPoint);
    process.stdout.write(formatDiff(diff(before, after), from, to, format));
    return OK;
  }
  if (command === "history") {
    const [sub, ...args] = rest;
    if (sub !== "build") throw new UsageError(sub ? `Unknown history command "${sub}".` : "Give a history command: build.");
    const { values } = parseArgs({ args, options: { since: { type: "string" } }, strict: true });
    const h = await historyFromCwd();
    const { revisions, built } = await buildHistory(h, values.since === undefined ? {} : { since: values.since });
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    process.stdout.write(`Built ${plural(built, "Revision")}; ${revisions - built} of ${revisions} already built.\n`);
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

/** The history of the Workspace found from the current folder; it must be in a git repo. */
async function historyFromCwd(): Promise<History> {
  const root = await workspaceRoot(process.cwd());
  const repoRoot = await gitTopLevel(root);
  if (!repoRoot) throw new UsageError("History needs the Workspace in a git repository.");
  return history(repoRoot, await realpath(root));
}

/** The site's past Bundles and Revision index; outside git, an empty index, so the viewer knows there is no history. */
async function writeSiteHistory(out: string, keep: number | "all") {
  const root = await workspaceRoot(process.cwd());
  const repoRoot = await gitTopLevel(root);
  if (repoRoot) await publishHistory(history(repoRoot, await realpath(root)), out, { keep });
  else {
    await mkdir(join(out, "bundles"), { recursive: true });
    await writeFile(join(out, "bundles", "index.json"), JSON.stringify({ schemaVersion: SCHEMA_VERSION, revisions: [] }, null, 2) + "\n");
  }
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
