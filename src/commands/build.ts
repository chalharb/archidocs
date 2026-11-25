import { existsSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { serializeBundle, type Issue } from "../core/index.ts";
import { defaultBaseBranch, previewSides, publishHistory, publishPreview, type History, type PreviewSides } from "../history/index.ts";
import { INDEX_PATH, INDEX_VERSION, LATEST_BUNDLE_PATH, SITE_FILE_PATH } from "../revisions/index.ts";
import type { Checkout } from "../workspace/index.ts";

export interface BuildOptions {
  /** The folder to write, absolute. */
  out: string;
  /** The prebuilt viewer, copied as is into a site. */
  viewerDir: string;
  /** How many past Bundles a site keeps: a count or all. */
  keep: number | "all";
  /** Write only the Bundle, not the site. */
  bundleOnly: boolean;
  /** Write a preview site of HEAD against `origin/<base>`; `base` defaults to origin's HEAD branch, else main. */
  preview?: { base?: string };
}

export type BuildResult =
  /** The Workspace has errors; nothing was written. */
  | { kind: "errors"; issues: Issue[] }
  /** A preview needs git and the Workspace isn't in a repo; nothing was written. */
  | { kind: "not-in-git" }
  /** A site needs the viewer, and `viewerDir` has none; nothing was written. */
  | { kind: "viewer-missing"; viewerDir: string }
  /** Wrote the Bundle alone, to `file`. */
  | { kind: "bundle"; file: string }
  /** Wrote the site to `out`. */
  | { kind: "site"; out: string }
  /** Wrote the preview site: the PR head against `origin/<base>`. */
  | { kind: "preview"; out: string; base: string; baseSha: string; headSha: string };

/** The Workspace's Bundle, alone or as a site with the viewer and past Bundles, or as a PR preview site. */
export async function build(checkout: Checkout, options: BuildOptions): Promise<BuildResult> {
  const { out, viewerDir, keep, bundleOnly } = options;
  const { bundle, issues } = await checkout.load();
  if (issues.some((i) => i.severity === "error")) return { kind: "errors", issues };
  // A preview finds both sides before writing anything, so a missing base writes no site.
  let preview: { h: History; sides: PreviewSides } | undefined;
  if (options.preview) {
    const repo = await checkout.repo();
    if (!repo) return { kind: "not-in-git" };
    const h = repo.history;
    preview = { h, sides: await previewSides(h, options.preview.base ?? (await defaultBaseBranch(h.repoRoot))) };
  }
  if (!bundleOnly) {
    if (!existsSync(join(viewerDir, "index.html"))) return { kind: "viewer-missing", viewerDir };
    await cp(viewerDir, out, { recursive: true });
    // The viewer's exports name the Workspace as `archidocs export` does: by its repo's folder.
    await writeFile(join(out, SITE_FILE_PATH), JSON.stringify({ workspace: await checkout.name() }) + "\n");
  }
  await mkdir(out, { recursive: true });
  const file = join(out, LATEST_BUNDLE_PATH);
  await writeFile(file, serializeBundle(bundle));
  if (preview) return { kind: "preview", out, ...(await publishPreview(preview.h, out, preview.sides, bundle)) };
  if (bundleOnly) return { kind: "bundle", file };
  await writeSiteHistory(checkout, out, keep);
  return { kind: "site", out };
}

/** The site's past Bundles and Revision index; outside git, an empty index, so the viewer knows there is no history. */
async function writeSiteHistory(checkout: Checkout, out: string, keep: number | "all") {
  const repo = await checkout.repo();
  if (repo) await publishHistory(repo.history, out, { keep });
  else {
    await mkdir(dirname(join(out, INDEX_PATH)), { recursive: true });
    await writeFile(join(out, INDEX_PATH), JSON.stringify({ schemaVersion: INDEX_VERSION, revisions: [] }, null, 2) + "\n");
  }
}
