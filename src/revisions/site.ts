import type { Bundle } from "../schema/bundle.ts";
import { migrateBundle, migrations, type Migration } from "./migrate.ts";
import { INDEX_PATH, INDEX_VERSION, LATEST_BUNDLE_PATH, pastBundlePath, type PreviewMark, type RevisionEntry, type RevisionIndex } from "./index.ts";

/**
 * A Bundle read from a site, latest or past: migrated to this Archidocs's
 * schema and parsed. Undefined when it is newer than this Archidocs, a
 * migration is missing, or it is not a Bundle at all.
 */
export function readBundle(raw: unknown, chain: Readonly<Record<number, Migration>> = migrations): Bundle | undefined {
  return migrateBundle(raw, chain);
}

/** A Revision index this version can read: {@link INDEX_VERSION} and an array of Revisions. Undefined otherwise. */
export function readIndex(raw: unknown): RevisionIndex | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const { schemaVersion, revisions, preview } = raw as { schemaVersion?: unknown; revisions?: unknown; preview?: Partial<PreviewMark> };
  if (schemaVersion !== INDEX_VERSION || !Array.isArray(revisions)) return undefined;
  return {
    schemaVersion,
    revisions: revisions as RevisionEntry[],
    ...(typeof preview?.baseSha === "string" ? { preview: preview as PreviewMark } : {}),
  };
}

/** What a host gave to tell whether a file has changed: an ETag, a Last-Modified date, or neither. */
export interface Validators {
  etag?: string;
  lastModified?: string;
}

/** A file read from a site: its text, unchanged since the validators sent, or not there (a 404 or ENOENT). */
export type SiteRead = { kind: "text"; text: string; validators: Validators } | { kind: "not_modified" } | { kind: "missing" };

/**
 * Reads files below a site's root. A failure other than a missing file
 * throws, and its message names where it read from.
 */
export interface SiteReader {
  /** Reads `path`, below the root with `/` separators; with validators, may answer "not modified". */
  read(path: string, validators?: Validators): Promise<SiteRead>;
  /** Where `path` is read from, a URL or a file path, for messages. */
  location(path: string): string;
}

/**
 * A browser-safe {@link SiteReader} over `fetch`, rooted at `base` (a URL
 * or a relative path such as `"./"`). It never uses the HTTP cache: the
 * validators it is given go out as `If-None-Match` and `If-Modified-Since`.
 */
export function fetchReader(base: string): SiteReader {
  const root = base.endsWith("/") ? base : `${base}/`;
  const location = (path: string) => `${root}${path}`;
  return {
    location,
    async read(path, validators) {
      const where = location(path);
      const headers: Record<string, string> = { accept: "application/json" };
      if (validators?.etag) headers["if-none-match"] = validators.etag;
      if (validators?.lastModified) headers["if-modified-since"] = validators.lastModified;
      const response = await fetch(where, { headers, cache: "no-store" });
      if (response.status === 304) return { kind: "not_modified" };
      if (response.status === 404) return { kind: "missing" };
      if (!response.ok) throw new Error(`${where} answered ${response.status} ${response.statusText}`.trim());
      const etag = response.headers.get("etag");
      const lastModified = response.headers.get("last-modified");
      return { kind: "text", text: await response.text(), validators: { ...(etag ? { etag } : {}), ...(lastModified ? { lastModified } : {}) } };
    },
  };
}

/** Why a site can't give history: a past Bundle dropped by retention, missing, unreadable or unmigratable, or an unreadable index. */
export type UnavailableReason = "dropped" | "missing" | "unreadable" | "unmigratable" | "index";

/** History the site can't give, with a reason and a message naming what is wrong. */
export interface HistoryUnavailable {
  ok: false;
  code: "history_unavailable";
  reason: UnavailableReason;
  message: string;
}

export interface SiteOptions {
  /** How long the latest Bundle and the index are trusted before the site is asked again; `Infinity` asks once. */
  recheckMs: number;
  /** The latest Bundle's path below the root. */
  bundle?: string;
  /** The migration chain; tests only, to migrate Bundles at a made-up older schema. */
  migrations?: Readonly<Record<number, Migration>>;
}

/** A published site: its latest Bundle, its Revision index and its past Bundles. */
export interface Site {
  /** Where the latest Bundle is read from. */
  readonly location: string;
  /** The latest Bundle. Rejects when it is missing, not JSON, or not a Bundle this version can read. */
  latest(): Promise<Bundle>;
  /** The Revision index; `index: undefined` when the site has none, which is no history. */
  index(): Promise<{ ok: true; index: RevisionIndex | undefined } | HistoryUnavailable>;
  /** A past Revision's Bundle, fetched once; a failure is dropped so the next call asks again. */
  bundle(revision: RevisionEntry): Promise<{ ok: true; bundle: Bundle } | HistoryUnavailable>;
}

const unavailable = (reason: UnavailableReason, message: string): HistoryUnavailable => ({ ok: false, code: "history_unavailable", reason, message });
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * One file re-read at most every `recheckMs`, sending the validators of the
 * text it holds. `interpret` turns the text (undefined when missing) into a
 * value; only values `keep` accepts are held, so a failure is asked again.
 */
function rechecked<T>(reader: SiteReader, path: string, recheckMs: number, interpret: (text: string | undefined) => T, keep: (value: T) => boolean = () => true) {
  let held: { value: T; at: number; validators: Validators } | undefined;
  return async (): Promise<T> => {
    const now = Date.now();
    if (held && now - held.at < recheckMs) return held.value;
    const read = await reader.read(path, held?.validators);
    if (read.kind === "not_modified") {
      if (!held) throw new Error(`${reader.location(path)} answered "not modified" to a request with no validators.`);
      held = { ...held, at: now };
      return held.value;
    }
    const value = interpret(read.kind === "text" ? read.text : undefined);
    if (keep(value)) held = { value, at: now, validators: read.kind === "text" ? read.validators : {} };
    return value;
  };
}

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/**
 * Opens a published site through `reader`. The latest Bundle and the index
 * are re-checked at most every `recheckMs`, with conditional requests when
 * the host gave validators; past Bundles never change, so each is read once.
 */
export function openSite(reader: SiteReader, { recheckMs, bundle: latestPath = LATEST_BUNDLE_PATH, migrations: chain = migrations }: SiteOptions): Site {
  const location = reader.location(latestPath);

  const latest = rechecked(reader, latestPath, recheckMs, (text) => {
    if (text === undefined) throw new Error(`${location} was not found.`);
    const json = parseJson(text);
    if (!json.ok) throw new Error(`${location} is not JSON.`);
    const read = readBundle(json.value, chain);
    if (!read) throw new Error(`${location} is not a Workspace Bundle this version can read.`);
    return read;
  });

  const index = rechecked(
    reader,
    INDEX_PATH,
    recheckMs,
    (text): { ok: true; index: RevisionIndex | undefined } | HistoryUnavailable => {
      if (text === undefined) return { ok: true, index: undefined };
      const json = parseJson(text);
      if (!json.ok) return unavailable("index", `The site has no readable Revision index (${INDEX_PATH}): ${reader.location(INDEX_PATH)} is not JSON.`);
      const read = readIndex(json.value);
      return read ? { ok: true, index: read } : unavailable("index", `The site's ${INDEX_PATH} holds no Revisions.`);
    },
    (value) => value.ok,
  );

  const pending = new Map<string, Promise<{ ok: true; bundle: Bundle } | HistoryUnavailable>>();
  const past = async (sha: string): Promise<{ ok: true; bundle: Bundle } | HistoryUnavailable> => {
    const short = sha.slice(0, 7);
    let read: SiteRead;
    try {
      read = await reader.read(pastBundlePath(sha));
    } catch (error) {
      return unavailable("unreadable", `The Bundle at ${short} can't be read from the site: ${errorText(error)}`);
    }
    if (read.kind !== "text") return unavailable("missing", `The Bundle at ${short} can't be read from the site: ${reader.location(pastBundlePath(sha))} was not found.`);
    const json = parseJson(read.text);
    if (!json.ok) return unavailable("unreadable", `The Bundle at ${short} can't be read from the site: ${reader.location(pastBundlePath(sha))} is not JSON.`);
    const bundle = readBundle(json.value, chain);
    return bundle ? { ok: true, bundle } : unavailable("unmigratable", `The Bundle at ${short} has a schema this Archidocs can't read or migrate.`);
  };

  return {
    location,
    latest,
    async index() {
      try {
        return await index();
      } catch (error) {
        return unavailable("index", `The site has no readable Revision index (${INDEX_PATH}): ${errorText(error)}`);
      }
    },
    bundle(revision) {
      if (revision.bundle === false) return Promise.resolve(unavailable("dropped", `The Bundle at ${revision.sha.slice(0, 7)} (${revision.date}) was not kept on this site.`));
      let read = pending.get(revision.sha);
      if (!read) {
        read = past(revision.sha);
        pending.set(revision.sha, read);
        // A failure may be a host's hiccup; ask again next time.
        void read.then((r) => !r.ok && pending.delete(revision.sha));
      }
      return read;
    },
  };
}
