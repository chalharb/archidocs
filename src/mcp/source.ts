import type { Issue } from "../core/index.ts";
import { checkoutAt, type Checkout } from "../workspace/index.ts";
import type { Bundle } from "../schema/bundle.ts";
import { openSite, type Site } from "../revisions/index.ts";
import { siteAt } from "./site.ts";

/** The Bundle the server answers from, with the issues Load found building it. */
export interface Snapshot {
  bundle: Bundle;
  issues: Issue[];
}

/**
 * Where the server reads the Workspace from. One source per server process,
 * set at startup: a local checkout, or a published Bundle file or URL.
 */
export type Source = CheckoutSource | BundleSource;

interface SourceBase {
  /** Whether the source can take edits at all; a Bundle never can. */
  readonly writesAllowed: boolean;
  /** The current Bundle, refreshed first if the source has changed. Rejects when the source can't be read. */
  snapshot(): Promise<Snapshot>;
}

export interface CheckoutSource extends SourceBase {
  readonly kind: "checkout";
  /** The Workspace root: the folder holding `workspace.yaml`. */
  readonly root: string;
  /** The Checkout at `root` the Bundle is built from. */
  readonly checkout: Checkout;
}

export interface BundleSource extends SourceBase {
  readonly kind: "bundle";
  /** The Bundle file's URL or absolute path. */
  readonly location: string;
  /** The site the Bundle is read from, which also holds its Revision index and past Bundles. */
  readonly site: Site;
}

/**
 * A local checkout: the Bundle is built in memory and rebuilt when a file
 * under the Workspace root changes or HEAD moves. Change is detected per
 * call from every model file's mtime and size, so an edit is seen by the very
 * next call with no watcher to start or stop.
 */
export function checkoutSource({ root }: { root: string }): CheckoutSource {
  const checkout = checkoutAt(root);
  let cached: { key: string; snapshot: Snapshot } | undefined;
  return {
    kind: "checkout",
    root,
    checkout,
    writesAllowed: true,
    async snapshot() {
      const [files, head] = await Promise.all([checkout.fingerprint(), checkout.head()]);
      const key = `${head.commit}\n${head.builtAt}\n${files}`;
      if (cached?.key !== key) cached = { key, snapshot: await checkout.load() };
      return cached.snapshot;
    },
  };
}

/** How long the site's latest Bundle and index are trusted before the site is asked again. */
const RECHECK_MS = 60_000;

/**
 * A published Workspace Bundle, read-only. `location` is a URL or a path,
 * naming either the Bundle file or the site (folder) that holds
 * `workspace.bundle.json`. The Bundle and the site's Revision index are
 * re-checked at most every 60 s; over HTTP the re-check is a conditional
 * request when the host gave an ETag or Last-Modified, so an unchanged file
 * costs a 304. A Bundle from an older Archidocs is migrated. A source that
 * can't be read, or doesn't hold a Bundle this version can read, rejects and
 * the tool returns `source_unavailable`; the next call tries again.
 */
export function bundleSource({ location }: { location: string }): BundleSource {
  const { reader, bundle } = siteAt(location);
  const site = openSite(reader, { recheckMs: RECHECK_MS, bundle });
  let held: Snapshot | undefined;
  return {
    kind: "bundle",
    site,
    get location() {
      return site.location;
    },
    writesAllowed: false,
    async snapshot() {
      const latest = await site.latest();
      // A Bundle is only ever published from a Workspace with no errors; check's warnings aren't kept in it.
      if (held?.bundle !== latest) held = { bundle: latest, issues: [] };
      return held;
    },
  };
}
