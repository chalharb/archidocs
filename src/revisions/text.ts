import { Bundle } from "../schema/bundle.ts";
import type { RevisionIndex } from "./index.ts";

/*
 * The text of a site's small files. Every writer, and `dev`, which serves a
 * site from memory, takes its bytes from here, so all of them agree.
 */

/** The Bundle as written to `workspace.bundle.json` (and to `bundles/<sha>.json`): stable key order, two-space indent. */
export function serializeBundle(bundle: Bundle): string {
  return JSON.stringify(Bundle.parse(bundle), null, 2) + "\n";
}

/** `site.json`: the Workspace's name, for the viewer's exports. */
export function serializeSiteFile(workspace: string): string {
  return JSON.stringify({ workspace }) + "\n";
}

/** `bundles/index.json`: `schemaVersion`, then `preview` when set, then the Revisions; two-space indent. */
export function serializeIndex({ schemaVersion, preview, revisions }: RevisionIndex): string {
  return JSON.stringify(preview ? { schemaVersion, preview, revisions } : { schemaVersion, revisions }, null, 2) + "\n";
}
