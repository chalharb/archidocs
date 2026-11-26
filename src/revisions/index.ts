/**
 * The Revision index and the layout of a published site. Browser-safe: the
 * viewer imports it as MCP and the CLI do, so nothing here may import from
 * `node:`. This file is the module's only entry.
 */
import type { ChangeCounts } from "../core/diff.ts";

/**
 * The Revision index's own version, written under the JSON key
 * `schemaVersion`. It is independent of the Bundle's `SCHEMA_VERSION`,
 * though both are 1 today: either can change without the other.
 */
export const INDEX_VERSION = 1;

/** One Revision as the index records it; `bundle: false` marks a Revision whose Bundle was dropped. */
export interface RevisionEntry {
  sha: string;
  date: string;
  subject: string;
  author: string;
  tags: string[];
  /** Changes against the previous Revision (or an empty Model for the first). */
  counts: ChangeCounts;
  changedIds: string[];
  bundle: boolean;
}

/** What a preview site's index adds: the base branch and both sides' shas, so the viewer opens with Compare "base → PR". */
export interface PreviewMark {
  base: string;
  baseSha: string;
  headSha: string;
}

/** The Revision index, as `bundles/index.json` and a checkout's cache hold it. */
export interface RevisionIndex {
  /** {@link INDEX_VERSION}, not the Bundle's schema version. */
  schemaVersion: number;
  /** Newest first. */
  revisions: RevisionEntry[];
  /** Set by `build --preview`. */
  preview?: PreviewMark;
}

/** A site's paths, relative to its root with `/` separators. */
export const LATEST_BUNDLE_PATH = "workspace.bundle.json";
/** The file that names the Workspace for the viewer's exports. */
export const SITE_FILE_PATH = "site.json";
/** The folder of past Bundles and the Revision index. */
export const BUNDLES_DIR = "bundles";
export const INDEX_PATH = `${BUNDLES_DIR}/index.json`;
/** A past Bundle's path: `bundles/<sha>.json`. */
export const pastBundlePath = (sha: string): string => `${BUNDLES_DIR}/${pastBundleFile(sha)}`;
/** A past Bundle's file name within `bundles/`. */
export const pastBundleFile = (sha: string): string => `${sha}.json`;
/** Whether a file name in `bundles/` is a past Bundle's, named by its full sha. */
export const isPastBundleFile = (name: string): boolean => /^[0-9a-f]{40,64}\.json$/.test(name);

export { find, span, timeSpan, POINT_GRAMMAR, type Dated, type Found, type Span } from "./find.ts";
export { migrateBundle, migrations, type Migration } from "./migrate.ts";
export {
  fetchReader,
  openSite,
  readBundle,
  readIndex,
  type HistoryUnavailable,
  type Site,
  type SiteOptions,
  type SiteRead,
  type SiteReader,
  type UnavailableReason,
  type Validators,
} from "./site.ts";
export { serializeBundle, serializeIndex, serializeSiteFile } from "./text.ts";
