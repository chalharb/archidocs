import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Bundle } from "../schema/bundle.ts";
import {
  BUNDLES_DIR,
  INDEX_PATH,
  isPastBundleFile,
  LATEST_BUNDLE_PATH,
  pastBundleFile,
  pastBundlePath,
  serializeBundle,
  serializeIndex,
  serializeSiteFile,
  SITE_FILE_PATH,
  type RevisionIndex,
} from "../revisions/index.ts";

/** A past Bundle to place in `bundles/`: copied from a file (the checkout's cache) or serialized from a Bundle. */
export type PastBundle = { sha: string; from: string } | { sha: string; bundle: Bundle };

export interface SiteContent {
  /** The latest Bundle, `workspace.bundle.json`. */
  bundle: Bundle;
  /** The Workspace's name for `site.json`; none for `--bundle-only`. */
  workspace?: string;
  /** The Revision index, `bundles/index.json`; none for `--bundle-only`. */
  index?: RevisionIndex;
  /** The past Bundles the index keeps. */
  past?: PastBundle[];
  /** Clear `bundles/` before writing, as a preview does, instead of removing only the past Bundles no longer kept. */
  clear?: boolean;
}

/**
 * Writes a site to `out`: the latest Bundle, `site.json` when there is a
 * name, the Revision index and each past Bundle. With an index, a past
 * Bundle file left in `bundles/` by an earlier build is removed once it is
 * no longer kept. The only code that writes a site's files; the viewer's
 * own files are copied in by `build`.
 */
export async function writeSite(out: string, { bundle, workspace, index, past = [], clear = false }: SiteContent): Promise<void> {
  await mkdir(out, { recursive: true });
  if (workspace !== undefined) await writeFile(join(out, SITE_FILE_PATH), serializeSiteFile(workspace));
  await writeFile(join(out, LATEST_BUNDLE_PATH), serializeBundle(bundle));
  if (!index) return;
  const dir = join(out, BUNDLES_DIR);
  if (clear) await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const kept = new Set(past.map((p) => pastBundleFile(p.sha)));
  if (!clear) {
    for (const file of await readdir(dir)) {
      if (isPastBundleFile(file) && !kept.has(file)) await rm(join(dir, file));
    }
  }
  for (const p of past) {
    const to = join(out, pastBundlePath(p.sha));
    if ("from" in p) await copyFile(p.from, to);
    else await writeFile(to, serializeBundle(p.bundle));
  }
  await writeFile(join(out, INDEX_PATH), serializeIndex(index));
}
