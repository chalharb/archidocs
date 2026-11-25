import { existsSync } from "node:fs";
import { cp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Bundle } from "../schema/bundle.ts";
import { findWorkspaceRoot, load, nodeFileSystem, resolveView, serializeBundle, type AnyView } from "../core/index.ts";
import { directions, layoutView, renderSequenceSvg, renderSvg, themes, type Direction, type Theme } from "../render/index.ts";
import { renderPngInNode } from "../render/node.ts";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { gitHead, gitTopLevel } from "../git.ts";
import { bundleSource, checkoutSource, createServer, DEFAULT_PORT, serveHttp } from "../mcp/index.ts";
import { authoringGuide } from "../guide/index.ts";
import { EXIT, NO_WORKSPACE, parseCommand, usageText } from "./commands.ts";
import { init } from "./init.ts";
import { DEFAULT_DEV_PORT, serveDev } from "./dev.ts";
import { exitCodeFor, formatIssues, formats, formatText, type Format } from "./format.ts";
import { diff } from "../core/index.ts";
import { bundleAt, buildHistory, DEFAULT_KEEP, defaultBaseBranch, history, previewSides, publishHistory, publishPreview, resolvePoint, type History, type PreviewSides } from "../history/index.ts";
import { INDEX_PATH, INDEX_VERSION, LATEST_BUNDLE_PATH, SITE_FILE_PATH } from "../revisions/index.ts";
import { SCHEMA_VERSION } from "../schema/bundle.ts";
import { diffFormats, formatDiff, type DiffFormat, type DiffSide } from "./diff-format.ts";

/** Where a run of the CLI writes and what it reads instead of `process`: its folder, environment and output streams. */
export interface Io {
  cwd: string;
  env: Record<string, string | undefined>;
  stdout: { write(chunk: string): unknown; isTTY?: boolean };
  stderr: { write(chunk: string): unknown };
}

/** Exit codes, shared with the command definitions that document them: 0 no errors, 1 errors found (or any warning with `--strict`), 2 could not run. */
const { ok: OK, foundErrors: FOUND_ERRORS, couldNotRun: COULD_NOT_RUN } = EXIT;

class UsageError extends Error {}

/**
 * The prebuilt viewer, which `build --out` copies as is. The CLI runs from
 * dist/cli/ when installed and from src/cli/ in this repo; both sit two
 * levels below the package root, whose dist/viewer/ holds the viewer.
 */
const VIEWER_DIR = fileURLToPath(new URL("../../dist/viewer/", import.meta.url));

/** The package's own package.json, two levels up from dist/cli/ or src/cli/ like the viewer. */
const PACKAGE_JSON = fileURLToPath(new URL("../../package.json", import.meta.url));

const usage = usageText();

/**
 * Runs one CLI command and returns its exit code. It never throws: an error is
 * written to `io.stderr` as `archidocs: <message>`, with the usage text for a
 * usage error, and returns the could-not-run code.
 */
export async function run(argv: string[], io: Io): Promise<number> {
  try {
    return await main(argv, io);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`archidocs: ${message}\n`);
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")) io.stderr.write(usage);
    return COULD_NOT_RUN;
  }
}

async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "init") {
    const { values } = parseCommand("init", rest);
    if (values.workspace !== undefined && !values.skill) throw new UsageError("--workspace only applies with --skill; without it, init uses or creates this repo's Workspace.");
    const cwd = await realpath(io.cwd);
    const repoRoot = (await gitTopLevel(cwd)) ?? cwd;
    const lines = await init({ repoRoot, cwd, skillOnly: values.skill, ...(values.workspace === undefined ? {} : { workspace: values.workspace }) });
    io.stdout.write(lines.join("\n") + "\n");
    return OK;
  }
  if (command === "version") {
    const { values } = parseCommand("version", rest);
    if (values.format !== "text" && values.format !== "json") throw new UsageError(`Unknown format "${values.format}"; use text or json.`);
    const { version } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string };
    io.stdout.write(values.format === "json" ? JSON.stringify({ version, schemaVersion: SCHEMA_VERSION }) + "\n" : `archidocs ${version} (Bundle schemaVersion ${SCHEMA_VERSION})\n`);
    return OK;
  }
  if (command === "guide") {
    const { positionals } = parseCommand("guide", rest);
    if (positionals.length > 1) throw new UsageError(`Give one topic at a time; got ${positionals.join(", ")}.`);
    const guide = await authoringGuide(positionals[0]);
    if (!guide.ok) throw new UsageError(guide.message);
    io.stdout.write(guide.text);
    return OK;
  }
  if (command === "check") {
    const { values } = parseCommand("check", rest);
    const format = values.format as Format;
    if (!formats.includes(format)) throw new UsageError(`Unknown format "${values.format}"; use ${formats.join(", ")}.`);
    const { issues } = await loadFromCwd(io.cwd);
    io.stdout.write(formatIssues(issues, format, { color: useColor(io) }));
    return exitCodeFor(issues, { strict: values.strict });
  }
  if (command === "build") {
    const { values } = parseCommand("build", rest);
    if (values.preview && values.keep !== undefined) throw new UsageError("--keep doesn't apply to --preview, whose site holds just the base and the PR head.");
    if (values.preview && values["bundle-only"]) throw new UsageError("--bundle-only doesn't apply to --preview, which writes a site.");
    if (values.base !== undefined && !values.preview) throw new UsageError("--base only applies with --preview.");
    const keep = values.keep === undefined ? DEFAULT_KEEP : values.keep === "all" ? "all" : Number(values.keep);
    if (keep !== "all" && !(Number.isInteger(keep) && keep >= 0)) throw new UsageError(`--keep "${values.keep}" is not a count or all.`);
    if (values["bundle-only"] && values.keep !== undefined) throw new UsageError("--keep only applies to a site; --bundle-only writes no past Bundles.");
    const { bundle, issues } = await loadFromCwd(io.cwd);
    if (issues.some((i) => i.severity === "error")) {
      io.stdout.write(formatText(issues, { color: useColor(io) }));
      io.stderr.write(`Not writing the ${values["bundle-only"] ? "Bundle" : "site"}: the Workspace has errors.\n`);
      return FOUND_ERRORS;
    }
    // A preview finds both sides before writing anything, so a missing base writes no site.
    let preview: { h: History; sides: PreviewSides } | undefined;
    if (values.preview) {
      const h = await historyFromCwd(io.cwd);
      preview = { h, sides: await previewSides(h, values.base ?? (await defaultBaseBranch(h.repoRoot))) };
    }
    const out = resolve(io.cwd, values.out);
    if (!values["bundle-only"]) {
      if (!existsSync(join(VIEWER_DIR, "index.html"))) throw new Error(`The viewer is not built (no ${VIEWER_DIR}); run \`pnpm build\` first.`);
      await cp(VIEWER_DIR, out, { recursive: true });
      // The viewer's exports name the Workspace as `archidocs export` does: by its repo's folder.
      const root = await workspaceRoot(io.cwd);
      await writeFile(join(out, SITE_FILE_PATH), JSON.stringify({ workspace: await workspaceName(root) }) + "\n");
    }
    await mkdir(out, { recursive: true });
    await writeFile(join(out, LATEST_BUNDLE_PATH), serializeBundle(bundle));
    if (preview) {
      const { base, baseSha, headSha } = await publishPreview(preview.h, out, preview.sides, bundle);
      io.stdout.write(`Wrote the preview site to ${values.out}: Compare origin/${base} (${baseSha.slice(0, 7)}) → PR (${headSha.slice(0, 7)})\n`);
      return OK;
    }
    if (!values["bundle-only"]) await writeSiteHistory(io.cwd, out, keep);
    io.stdout.write(values["bundle-only"] ? `Wrote ${join(values.out, LATEST_BUNDLE_PATH)}\n` : `Wrote the site to ${values.out}\n`);
    return OK;
  }
  if (command === "dev") {
    const { values } = parseCommand("dev", rest);
    const port = values.port === undefined ? DEFAULT_DEV_PORT : Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`--port "${values.port}" is not a port.`);
    if (!existsSync(join(VIEWER_DIR, "index.html"))) throw new Error(`The viewer is not built (no ${VIEWER_DIR}); run \`pnpm build\` first.`);
    const root = await workspaceRoot(values.workspace === undefined ? io.cwd : resolve(io.cwd, values.workspace));
    const color = useColor(io);
    const dev = await serveDev({
      root,
      viewerDir: VIEWER_DIR,
      workspace: await workspaceName(root),
      port,
      ...(values.host === undefined ? {} : { host: values.host }),
      onLoad: ({ issues, kept, first }) => {
        const shown = issues.filter((i) => i.severity === "error" || first);
        if (shown.length > 0) io.stdout.write(formatText(shown, { color }));
        if (kept) io.stderr.write("The Workspace has errors; still serving the last good Bundle.\n");
        else if (!first) io.stderr.write(`Reloaded the Workspace (${new Date().toLocaleTimeString()})\n`);
      },
    }).catch((e: unknown) => {
      if ((e as { code?: string }).code === "EADDRINUSE") throw new UsageError(`Port ${port} is in use; pick another with --port.`);
      throw e;
    });
    io.stderr.write(`Archidocs dev server on ${dev.url} (watching ${root}; Ctrl+C to stop)\n`);
    return OK;
  }
  if (command === "export") {
    const { values, positionals } = parseCommand("export", rest);
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
    const theme = values.theme as Theme;
    if (!themes.includes(theme)) throw new UsageError(`Unknown theme "${values.theme}"; use ${themes.join(" or ")}.`);
    const { label } = values;
    const root = await workspaceRoot(io.cwd);
    const { bundle, issues } = await loadFromCwd(io.cwd);
    if (issues.some((i) => i.severity === "error")) {
      io.stdout.write(formatText(issues, { color: useColor(io) }));
      io.stderr.write("Not exporting: the Workspace has errors.\n");
      return FOUND_ERRORS;
    }
    const workspace = await workspaceName(root);
    const fileName = (id: string) => `${id.replace(/[/:]/g, "-")}.${format}`;
    const source = { workspace, commit: bundle.commit, date: bundle.builtAt };
    const write = async (svg: string, out: string) => {
      await writeFile(resolve(io.cwd, out), format === "svg" ? svg : await renderPngInNode(svg));
      io.stdout.write(`Wrote ${out}\n`);
    };
    /** Lays out and draws one View: a Dynamic View as a sequence chart, any other as a diagram; `--direction` wins over the View's own. */
    const draw = async (view: AnyView, out: string) => {
      if (view.kind === "dynamic") return write(renderSequenceSvg({ bundle, view, source, theme, label }), out);
      const layout = await layoutView(view, direction === undefined ? {} : { direction });
      await write(renderSvg({ bundle, view, layout, source, theme, label }), out);
    };

    if (allSaved) {
      await mkdir(resolve(io.cwd, values.out!), { recursive: true });
      for (const saved of bundle.views) {
        const view = resolveView(bundle, saved.id);
        if (view) await draw(view, join(values.out!, fileName(saved.id)));
      }
      return OK;
    }
    const view = resolveView(bundle, viewId!);
    if (!view) throw new UsageError(`Unknown View "${viewId}"; Views are c1, c2, c2/<system>, c3/<service with Components>, deployment/<environment> and Saved Views (project:view-id).`);
    await draw(view, values.out ?? fileName(viewId!));
    return OK;
  }
  if (command === "diff") {
    const { values, positionals } = parseCommand("diff", rest);
    const format = values.format as DiffFormat;
    if (!diffFormats.includes(format)) throw new UsageError(`Unknown format "${values.format}"; use ${diffFormats.join(", ")}.`);
    const [fromPoint, toPoint, ...extra] = positionals;
    if (fromPoint === undefined) throw new UsageError("Give the point to diff from: a ref or a date.");
    if (extra.length > 0) throw new UsageError(`Give at most two points; got ${positionals.join(", ")}.`);
    const h = await historyFromCwd(io.cwd);
    /** A point's Bundle; with no point, the working tree's. */
    const side = async (point: string | undefined): Promise<[DiffSide, Bundle]> => {
      if (point === undefined) return [{ point: "working tree", commit: null }, (await loadFromCwd(io.cwd)).bundle];
      const commit = await resolvePoint(h.repoRoot, point);
      if (!commit) throw new UsageError(`Unknown ref or date "${point}"; a date resolves to the last default-branch commit at or before it.`);
      return [{ point, commit }, (await bundleAt(h, commit)).bundle];
    };
    const [from, before] = await side(fromPoint);
    const [to, after] = await side(toPoint);
    io.stdout.write(formatDiff(diff(before, after), from, to, format));
    return OK;
  }
  if (command === "history") {
    const [sub, ...args] = rest;
    if (sub !== "build") throw new UsageError(sub ? `Unknown history command "${sub}".` : "Give a history command: build.");
    const { values } = parseCommand("history build", args);
    const h = await historyFromCwd(io.cwd);
    const { revisions, built } = await buildHistory(h, values.since === undefined ? {} : { since: values.since });
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    io.stdout.write(`Built ${plural(built, "Revision")}; ${revisions - built} of ${revisions} already built.\n`);
    return OK;
  }
  if (command === "mcp") {
    const { values } = parseCommand("mcp", rest);
    const viewerUrl = values["viewer-url"];
    if (viewerUrl !== undefined && !URL.canParse(viewerUrl)) throw new UsageError(`--viewer-url "${viewerUrl}" is not a URL.`);
    if (values.workspace !== undefined && values.bundle !== undefined) throw new UsageError("Give --workspace or --bundle, not both.");
    if (!values.http && values["allow-writes"]) throw new UsageError("--allow-writes only applies with --http; over stdio a checkout already takes writes.");
    if (!values.http && (values.host !== undefined || values.port !== undefined)) throw new UsageError("--host and --port only apply with --http.");
    const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`--port "${values.port}" is not a port.`);

    const source =
      values.bundle !== undefined
        ? bundleSource({ location: /^https?:\/\//i.test(values.bundle) ? values.bundle : resolve(io.cwd, values.bundle) })
        : checkoutSource({ root: await workspaceRoot(values.workspace === undefined ? io.cwd : resolve(io.cwd, values.workspace)) });
    const options = { source, ...(viewerUrl === undefined ? {} : { viewerUrl }) };
    if (values.http) {
      const http = await serveHttp({ ...options, port, allowWrites: values["allow-writes"], ...(values.host === undefined ? {} : { host: values.host }) });
      io.stderr.write(`Archidocs MCP server on ${http.url} (writes ${values["allow-writes"] && source.writesAllowed ? "allowed" : "off"})\n`);
      return OK;
    }
    // The one command bound to the process: stdout carries the protocol; the server runs until the client closes stdin.
    serveStdio(() => createServer(options));
    return OK;
  }
  throw new UsageError(command ? `Unknown command "${command}".` : "No command given.");
}

/** Colour only on a terminal; `NO_COLOR` turns it off and `FORCE_COLOR` on. */
function useColor(io: Io): boolean {
  const { NO_COLOR, FORCE_COLOR } = io.env;
  if (NO_COLOR) return false;
  if (FORCE_COLOR !== undefined) return FORCE_COLOR !== "0";
  return io.stdout.isTTY === true;
}

/** How a picture's source line names the Workspace: its git repo's folder, else the Workspace root's. */
async function workspaceName(root: string): Promise<string> {
  return basename((await gitTopLevel(root)) ?? root);
}

async function workspaceRoot(start: string): Promise<string> {
  const root = await findWorkspaceRoot(nodeFileSystem(), start);
  if (!root) throw new UsageError(NO_WORKSPACE);
  return root;
}

/** The history of the Workspace found from `cwd`; it must be in a git repo. */
async function historyFromCwd(cwd: string): Promise<History> {
  const root = await workspaceRoot(cwd);
  const repoRoot = await gitTopLevel(root);
  if (!repoRoot) throw new UsageError("History needs the Workspace in a git repository.");
  return history(repoRoot, await realpath(root));
}

/** The site's past Bundles and Revision index; outside git, an empty index, so the viewer knows there is no history. */
async function writeSiteHistory(cwd: string, out: string, keep: number | "all") {
  const root = await workspaceRoot(cwd);
  const repoRoot = await gitTopLevel(root);
  if (repoRoot) await publishHistory(history(repoRoot, await realpath(root)), out, { keep });
  else {
    await mkdir(dirname(join(out, INDEX_PATH)), { recursive: true });
    await writeFile(join(out, INDEX_PATH), JSON.stringify({ schemaVersion: INDEX_VERSION, revisions: [] }, null, 2) + "\n");
  }
}

async function loadFromCwd(cwd: string) {
  const root = await workspaceRoot(cwd);
  const { commit, builtAt } = await gitHead(root);
  return load({ fs: nodeFileSystem(), root, commit, builtAt });
}
