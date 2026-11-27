import { existsSync, statSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { directions, type Direction } from "../render/layout.ts";
import { themes, type Theme } from "../render/tokens.ts";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { gitTopLevel } from "../git.ts";
import { findCheckout, type Checkout } from "../workspace/index.ts";
import { build, buildHistory, check, diff, exportViews, gaps } from "../commands/index.ts";
import { bundleSource, checkoutSource, checkServer, createServer, DEFAULT_PORT, serveHttp, startupLine } from "../mcp/index.ts";
import { guide as skillGuide } from "../guide/index.ts";
import { EXIT, NO_WORKSPACE, parseCommand, usageText } from "./commands.ts";
import { init } from "./init.ts";
import { DEFAULT_DEV_PORT, serveDev } from "./dev.ts";
import { exitCodeFor, formatIssues, formats, formatText, type Format } from "./format.ts";
import { DEFAULT_KEEP, pointMessage } from "../history/index.ts";
import { formatGaps } from "../core/index.ts";
import { didYouMean } from "../core/suggest.ts";
import { LATEST_BUNDLE_PATH } from "../revisions/index.ts";
import { SCHEMA_VERSION } from "../schema/bundle.ts";
import { diffFormats, formatDiff, type DiffFormat } from "./diff-format.ts";

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

const NOT_IN_GIT = "History needs the Workspace in a git repository.";

const viewerMissing = (viewerDir: string) => `The viewer is not built (no ${viewerDir}); run \`pnpm build\` first.`;

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
    const { version } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string };
    const lines = await init({ repoRoot, cwd, skillOnly: values.skill, noClaudeSkills: values["no-claude-skills"], env: io.env, version, ...(values.workspace === undefined ? {} : { workspace: values.workspace }) });
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
    const { positionals, values } = parseCommand("guide", rest);
    if (positionals.length > 1) throw new UsageError(`Give one topic at a time; got ${positionals.join(", ")}.`);
    const guide = await skillGuide(values.skill, positionals[0]);
    if (!guide.ok) throw new UsageError(guide.message);
    io.stdout.write(guide.text);
    return OK;
  }
  if (command === "check") {
    const { values } = parseCommand("check", rest);
    const format = values.format as Format;
    if (!formats.includes(format)) throw new UsageError(`Unknown format "${values.format}"; use ${formats.join(", ")}.`);
    const { issues } = await check(await checkoutFrom(io.cwd));
    io.stdout.write(formatIssues(issues, format, { color: useColor(io) }));
    return exitCodeFor(issues, { strict: values.strict });
  }
  if (command === "gaps") {
    const { values } = parseCommand("gaps", rest);
    const result = await gaps(await checkoutFrom(io.cwd), {
      ...(values.project === undefined ? {} : { project: values.project }),
      ...(values.owner === undefined ? {} : { owner: values.owner }),
    });
    switch (result.kind) {
      case "errors":
        io.stdout.write(formatText(result.issues, { color: useColor(io) }));
        io.stderr.write("Not listing gaps: the Workspace has errors.\n");
        return FOUND_ERRORS;
      case "unknown":
        throw new UsageError(`Unknown ${result.what} "${result.id}"${didYouMean(result.id, result.known) || "."}`);
      case "gaps":
        if (values.json) io.stdout.write(JSON.stringify({ total: result.gaps.length, gaps: result.gaps }, null, 2) + "\n");
        else io.stdout.write(result.gaps.length ? formatGaps(result.gaps, result.bundle) : "No gaps.\n");
        return OK;
    }
  }
  if (command === "build") {
    const { values } = parseCommand("build", rest);
    if (values.preview && values.keep !== undefined) throw new UsageError("--keep doesn't apply to --preview, whose site holds just the base and the PR head.");
    if (values.preview && values["bundle-only"]) throw new UsageError("--bundle-only doesn't apply to --preview, which writes a site.");
    if (values.base !== undefined && !values.preview) throw new UsageError("--base only applies with --preview.");
    const keep = values.keep === undefined ? DEFAULT_KEEP : values.keep === "all" ? "all" : Number(values.keep);
    if (keep !== "all" && !(Number.isInteger(keep) && keep >= 0)) throw new UsageError(`--keep "${values.keep}" is not a count or all.`);
    if (values["bundle-only"] && values.keep !== undefined) throw new UsageError("--keep only applies to a site; --bundle-only writes no past Bundles.");
    const result = await build(await checkoutFrom(io.cwd), {
      out: resolve(io.cwd, values.out),
      viewerDir: VIEWER_DIR,
      keep,
      bundleOnly: values["bundle-only"],
      ...(values.preview ? { preview: values.base === undefined ? {} : { base: values.base } } : {}),
    });
    switch (result.kind) {
      case "errors":
        io.stdout.write(formatText(result.issues, { color: useColor(io) }));
        io.stderr.write(`Not writing the ${values["bundle-only"] ? "Bundle" : "site"}: the Workspace has errors.\n`);
        return FOUND_ERRORS;
      case "not-in-git":
        throw new UsageError(NOT_IN_GIT);
      case "viewer-missing":
        throw new Error(viewerMissing(result.viewerDir));
      case "preview":
        io.stdout.write(`Wrote the preview site to ${values.out}: Compare origin/${result.base} (${result.baseSha.slice(0, 7)}) → PR (${result.headSha.slice(0, 7)})\n`);
        return OK;
      case "bundle":
        io.stdout.write(`Wrote ${join(values.out, LATEST_BUNDLE_PATH)}\n`);
        return OK;
      case "site":
        io.stdout.write(`Wrote the site to ${values.out}\n`);
        return OK;
    }
  }
  if (command === "dev") {
    const { values } = parseCommand("dev", rest);
    const port = values.port === undefined ? DEFAULT_DEV_PORT : Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`--port "${values.port}" is not a port.`);
    if (!existsSync(join(VIEWER_DIR, "index.html"))) throw new Error(viewerMissing(VIEWER_DIR));
    const checkout = await checkoutFrom(workspaceFolder(io.cwd, values.workspace));
    const color = useColor(io);
    const dev = await serveDev({
      checkout,
      viewerDir: VIEWER_DIR,
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
    io.stderr.write(`Archidocs dev server on ${dev.url} (watching ${checkout.root}; Ctrl+C to stop)\n`);
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
    const result = await exportViews(await checkoutFrom(io.cwd), {
      views: allSaved ? "all-saved" : [viewId!],
      format,
      ...(direction === undefined ? {} : { direction }),
      theme,
      ...(label === undefined ? {} : { label }),
      out: allSaved ? resolve(io.cwd, values.out!) : io.cwd,
      ...(!allSaved && values.out !== undefined ? { file: resolve(io.cwd, values.out) } : {}),
    });
    switch (result.kind) {
      case "errors":
        io.stdout.write(formatText(result.issues, { color: useColor(io) }));
        io.stderr.write("Not exporting: the Workspace has errors.\n");
        return FOUND_ERRORS;
      case "unknown-view":
        throw new UsageError(`Unknown View "${result.id}"; Views are c1, c2, c2/<system>, c3/<service with Components>, deployment/<environment> and Saved Views (project:view-id).`);
      case "written":
        // Each picture as the user named it: under --out, or --out itself, or its own name in the current folder.
        for (const { path } of result.files) io.stdout.write(`Wrote ${allSaved ? join(values.out!, basename(path)) : (values.out ?? basename(path))}\n`);
        return OK;
    }
  }
  if (command === "diff") {
    const { values, positionals } = parseCommand("diff", rest);
    const format = values.format as DiffFormat;
    if (!diffFormats.includes(format)) throw new UsageError(`Unknown format "${values.format}"; use ${diffFormats.join(", ")}.`);
    const [fromPoint, toPoint, ...extra] = positionals;
    if (fromPoint === undefined) throw new UsageError("Give the point to diff from: a ref or a date.");
    if (extra.length > 0) throw new UsageError(`Give at most two points; got ${positionals.join(", ")}.`);
    const result = await diff(await checkoutFrom(io.cwd), toPoint === undefined ? { from: fromPoint } : { from: fromPoint, to: toPoint });
    if (result.kind === "not-in-git") throw new UsageError(NOT_IN_GIT);
    if (result.kind === "unknown-point") throw new UsageError(pointMessage(result.point, result.failure));
    io.stdout.write(formatDiff(result.changes, result.from, result.to, format));
    return OK;
  }
  if (command === "history") {
    const [sub, ...args] = rest;
    if (sub !== "build") throw new UsageError(sub ? `Unknown history command "${sub}".` : "Give a history command: build.");
    const { values } = parseCommand("history build", args);
    const result = await buildHistory(await checkoutFrom(io.cwd), values.since === undefined ? {} : { since: values.since });
    if (result.kind === "not-in-git") throw new UsageError(NOT_IN_GIT);
    const { revisions, built } = result;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    io.stdout.write(`Built ${plural(built, "Revision")}; ${revisions - built} of ${revisions} already built.\n`);
    return OK;
  }
  if (command === "mcp") {
    const { values } = parseCommand("mcp", rest);
    const viewerUrl = values["viewer-url"];
    if (viewerUrl !== undefined && !URL.canParse(viewerUrl)) throw new UsageError(`--viewer-url "${viewerUrl}" is not a URL.`);
    if (values.workspace !== undefined && values.bundle !== undefined) throw new UsageError("Give --workspace or --bundle, not both.");
    if (values.http && values.check) throw new UsageError("--check runs the stdio server; leave out --http.");
    if (!values.http && values["allow-writes"]) throw new UsageError("--allow-writes only applies with --http; over stdio a checkout already takes writes.");
    if (!values.http && (values.host !== undefined || values.port !== undefined)) throw new UsageError("--host and --port only apply with --http.");
    const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError(`--port "${values.port}" is not a port.`);

    const source =
      values.bundle !== undefined
        ? bundleSource({ location: /^https?:\/\//i.test(values.bundle) ? values.bundle : resolve(io.cwd, values.bundle) })
        : checkoutSource({ root: (await checkoutFrom(workspaceFolder(io.cwd, values.workspace))).root });
    const { version } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string };
    const log = (line: string) => void io.stderr.write(`${line}\n`);
    const options = { source, version, log, logReads: io.env["ARCHIDOCS_LOG"] === "debug", ...(viewerUrl === undefined ? {} : { viewerUrl }) };
    if (values.check) {
      const result = await checkServer(options);
      io.stdout.write(result.lines.join("\n") + "\n");
      if (!result.ok) io.stderr.write(`archidocs: ${result.error}\n`);
      return result.ok ? OK : COULD_NOT_RUN;
    }
    if (values.http) {
      const writesAllowed = values["allow-writes"] && source.writesAllowed;
      const http = await serveHttp({ ...options, port, allowWrites: values["allow-writes"], ...(values.host === undefined ? {} : { host: values.host }) });
      log(`Archidocs MCP server on ${http.url} (writes ${writesAllowed ? "allowed" : "off"})`);
      void startupLine({ version, transport: "http", source, writesAllowed }).then(log);
      return OK;
    }
    // The one command bound to the process: stdout carries the protocol; the server runs until the client closes stdin.
    // It answers the client at once, and says what it serves once the source has loaded.
    serveStdio(() => createServer(options));
    void startupLine({ version, transport: "stdio", source, writesAllowed: source.writesAllowed }).then(log);
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

/** The Checkout whose Workspace holds `start`, found by walking up from it. */
/**
 * Where to look for the Workspace: the current folder, or the folder
 * `--workspace` names. A named folder must exist, so a mistyped path fails
 * instead of finding a Workspace in a folder above it.
 */
function workspaceFolder(cwd: string, workspace: string | undefined): string {
  if (workspace === undefined) return cwd;
  const folder = resolve(cwd, workspace);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error(`--workspace "${workspace}" is not a folder.`);
  return folder;
}

async function checkoutFrom(start: string): Promise<Checkout> {
  const checkout = await findCheckout(start);
  if (!checkout) throw new UsageError(NO_WORKSPACE);
  return checkout;
}
