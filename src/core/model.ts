import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "tinyglobby";
import type { ModelFile, ViewSummary } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Collects the views declared under `metadata.views`, which may be an object or a list of objects. */
function readViews(metadata: unknown): ViewSummary[] {
  const blocks = Array.isArray(metadata) ? metadata : [metadata];
  const views: ViewSummary[] = [];
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block["views"])) continue;
    for (const view of block["views"]) {
      if (!isRecord(view) || typeof view["id"] !== "string") continue;
      views.push({
        id: view["id"],
        title: typeof view["title"] === "string" ? view["title"] : view["id"],
        ...(typeof view["group"] === "string" ? { group: view["group"] } : {}),
      });
    }
  }
  return views;
}

/** Reads one CALM file. A bad file yields errors instead of throwing, so other files still build. */
export async function loadModelFile(dir: string, file: string): Promise<ModelFile> {
  const fail = (message: string, field?: string): ModelFile => ({
    file,
    views: [],
    errors: [{ severity: "error", file, ...(field ? { path: field } : {}), message }],
  });
  let document: unknown;
  try {
    document = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  } catch (error) {
    return fail(`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(document)) return fail("The file must contain a JSON object.");
  if (!Array.isArray(document["nodes"])) return fail("must be an array", "nodes");
  if (document["relationships"] !== undefined && !Array.isArray(document["relationships"])) {
    return fail("must be an array", "relationships");
  }
  return { file, views: readViews(document["metadata"]), errors: [] };
}

/** Finds the model files matched by the config globs, sorted for stable output. */
export async function loadModel(dir: string, patterns: string | string[]): Promise<ModelFile[]> {
  const files = await glob(patterns, { cwd: dir, onlyFiles: true });
  files.sort();
  return Promise.all(files.map((file) => loadModelFile(dir, file)));
}
