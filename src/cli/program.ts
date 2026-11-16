import { cac } from "cac";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runBuild } from "./commands/build.js";
import { runInit } from "./commands/init.js";
import { runDev, runValidate } from "./commands/stubs.js";
import type { Io } from "./io.js";

export interface ProgramOptions {
  io: Io;
  cwd: string;
  viewerDir: string;
}

/** Parses `argv` and runs the matching command, returning the process exit code. */
export async function runProgram(argv: string[], options: ProgramOptions): Promise<number> {
  const { io, cwd, viewerDir } = options;
  const cli = cac("archidocs");
  let result: Promise<number> | number | undefined;

  cli.command("init", "Write a starter config and a tiny CALM model").action(() => {
    result = runInit(cwd, io);
  });
  cli.command("validate", "Check the model before you merge").action(() => {
    result = runValidate(io);
  });
  cli.command("dev", "Preview the site while you edit the model").action(() => {
    result = runDev(io);
  });
  cli
    .command("build", "Write the static site")
    .option("--out <dir>", "Output folder", { default: "archidocs-site" })
    .action((opts: { out: string }) => {
      result = runBuild({ dir: cwd, out: path.resolve(cwd, opts.out), viewerDir }, io);
    });
  cli.help();
  cli.version(await readVersion());

  try {
    cli.parse(["node", "archidocs", ...argv], { run: false });
    if (cli.options["help"] || cli.options["version"]) return 0;
    if (!cli.matchedCommand) {
      io.error(argv.length ? `Unknown command: ${argv[0]}` : "No command given.");
      cli.outputHelp();
      return 1;
    }
    await cli.runMatchedCommand();
    return (await result) ?? 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function readVersion(): Promise<string> {
  try {
    const file = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(await readFile(file, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
