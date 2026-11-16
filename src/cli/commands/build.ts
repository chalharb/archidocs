import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatDiagnostic, loadConfig } from "../../core/config.js";
import { loadModel } from "../../core/model.js";
import type { SiteData } from "../../core/types.js";
import type { Io } from "../io.js";

export const DATA_FILE = "archidocs-data.json";

export interface BuildOptions {
  dir: string;
  out: string;
  /** Folder holding the prebuilt viewer. */
  viewerDir: string;
}

function isInsideOrSame(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Copies the prebuilt viewer to the output folder and writes the model as a data file. */
export async function runBuild(options: BuildOptions, io: Io): Promise<number> {
  const dir = path.resolve(options.dir);
  const out = path.resolve(dir, options.out);
  if (isInsideOrSame(out, dir)) {
    io.error(`The output folder ${out} would contain the workspace; choose another with --out.`);
    return 1;
  }

  const loaded = await loadConfig(dir);
  if (!loaded.ok) {
    loaded.diagnostics.forEach((d) => io.error(formatDiagnostic(d)));
    return 1;
  }
  const { config } = loaded;
  const files = await loadModel(dir, config.model);
  files.flatMap((f) => f.errors).forEach((d) => io.error(formatDiagnostic(d)));

  const data: SiteData = {
    version: 1,
    name: config.name,
    title: config.title ?? config.name,
    base: config.site?.base ?? "/",
    files,
  };

  await rm(out, { recursive: true, force: true });
  await mkdir(path.dirname(out), { recursive: true });
  await cp(options.viewerDir, out, { recursive: true });
  await writeFile(path.join(out, DATA_FILE), `${JSON.stringify(data, null, 2)}\n`);

  const viewCount = files.reduce((sum, f) => sum + f.views.length, 0);
  io.log(
    `Built ${viewCount} view(s) from ${files.length} file(s) into ${path.relative(dir, out) || "."}`,
  );
  return 0;
}
