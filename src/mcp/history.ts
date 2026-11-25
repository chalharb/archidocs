import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { bundleAt, buildHistory, isDate, migrateBundle, readIndex, resolvePoint, type History } from "../history/index.ts";
import { INDEX_PATH, pastBundlePath, type RevisionEntry } from "../revisions/index.ts";
import { commitInfo } from "../history/git.ts";
import type { Bundle } from "../schema/bundle.ts";
import type { BundleSource, CheckoutSource, Snapshot, Source } from "./source.ts";

/** Why a point in time can't be answered: it names no commit, or its Bundle can't be had. */
export type PastFailure = { ok: false; code: "not_found" | "history_unavailable"; message: string; suggestions?: string[] };

/** A Snapshot at a point in time: the commit the point resolved to and the Bundle there. */
export type PastSnapshot = { ok: true; commit: string; snapshot: Snapshot };

/**
 * The source's past: Bundles at a point in time and the Revision index.
 * A checkout builds both from git and caches them in `.archidocs/cache/`;
 * a published Bundle reads `bundles/index.json` and `bundles/<sha>.json`
 * beside it, and reports a Bundle it can't have as `history_unavailable`.
 */
export interface Past {
  /** The Bundle at a ref or a date. `current` answers when the point is the commit the source already holds. */
  at(point: string, current: Snapshot): Promise<PastSnapshot | PastFailure>;
  /** The Revisions, newest first, as the index records them. */
  index(): Promise<{ ok: true; revisions: RevisionEntry[] } | PastFailure>;
  /** The time a ref or a date stands for: a commit's date, or the start (or end) of a day. */
  time(point: string, edge: "start" | "end"): Promise<{ ok: true; time: number } | PastFailure>;
}

export function pastOf(source: Source): Past {
  return source.kind === "checkout" ? checkoutPast(source) : bundlePast(source);
}

const unavailable = (message: string): PastFailure => ({ ok: false, code: "history_unavailable", message });
const noCommit = (point: string, suggestions?: string[]): PastFailure => ({
  ok: false,
  code: "not_found",
  message: `"${point}" names no Revision: give a ref (sha, tag or branch) or a date (YYYY-MM-DD).`,
  ...(suggestions?.length ? { suggestions } : {}),
});
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A bare date's start or end (UTC); a full time as given. */
function dateTime(point: string, edge: "start" | "end"): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(point)) return Date.parse(`${point}T${edge === "start" ? "00:00:00" : "23:59:59"}Z`);
  return Date.parse(point);
}

function checkoutPast(source: CheckoutSource): Past {
  const repo = async (): Promise<History | undefined> => (await source.checkout.repo())?.history;
  const noGit = unavailable(`The Workspace at ${source.root} is not in a git repository, so it has no history.`);

  return {
    async at(point) {
      const h = await repo();
      if (!h) return noGit;
      const sha = await resolvePoint(h.repoRoot, point);
      if (!sha) return noCommit(point);
      try {
        return { ok: true, commit: sha, snapshot: { bundle: (await bundleAt(h, sha)).bundle, issues: [] } };
      } catch (error) {
        return unavailable(`Could not build the Bundle at ${sha.slice(0, 7)}: ${reason(error)}`);
      }
    },
    async index() {
      const h = await repo();
      if (!h) return noGit;
      try {
        // Builds what the cache lacks, once per Revision; afterwards the index is only read.
        await buildHistory(h);
        return { ok: true, revisions: (await readIndex(h)).revisions };
      } catch (error) {
        return unavailable(`Could not read the history of ${h.repoRoot}: ${reason(error)}`);
      }
    },
    async time(point, edge) {
      if (isDate(point)) return { ok: true, time: dateTime(point, edge) };
      const h = await repo();
      if (!h) return noGit;
      const sha = await resolvePoint(h.repoRoot, point);
      if (!sha) return noCommit(point);
      return { ok: true, time: Date.parse((await commitInfo(h.repoRoot, sha)).date) };
    },
  };
}

/** How long a fetched index is trusted before the site is asked again, as for the Bundle. */
const RECHECK_MS = 60_000;

function bundlePast(source: BundleSource): Past {
  // Past Bundles are immutable, so each is fetched once.
  const bundles = new Map<string, Promise<Bundle | PastFailure>>();
  let cached: { revisions: RevisionEntry[]; checkedAt: number } | undefined;

  const sibling = (path: string) => {
    const location = source.location;
    return /^https?:\/\//i.test(location) ? new URL(path, location).href : join(dirname(location), path);
  };
  const read = async (path: string): Promise<string> => {
    const where = sibling(path);
    if (!/^https?:\/\//i.test(where)) return readFile(where, "utf8");
    const response = await fetch(where, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`${where} answered ${response.status} ${response.statusText}`.trim());
    return response.text();
  };

  const index: Past["index"] = async () => {
    const now = Date.now();
    if (cached && now - cached.checkedAt < RECHECK_MS) return { ok: true, revisions: cached.revisions };
    let raw: unknown;
    try {
      raw = JSON.parse(await read(INDEX_PATH));
    } catch (error) {
      return unavailable(`The site has no readable Revision index (${INDEX_PATH}): ${reason(error)}`);
    }
    const revisions = (raw as { revisions?: unknown } | null)?.revisions;
    if (!Array.isArray(revisions)) return unavailable(`The site's ${INDEX_PATH} holds no Revisions.`);
    cached = { revisions: revisions as RevisionEntry[], checkedAt: now };
    return { ok: true, revisions: cached.revisions };
  };

  /** A point as a Revision of the index: the last at or before a date, a tag, or a sha (or its prefix). */
  const entryAt = async (point: string): Promise<RevisionEntry | PastFailure> => {
    const listed = await index();
    if (!listed.ok) return listed;
    const { revisions } = listed;
    if (isDate(point)) {
      const time = dateTime(point, "end");
      return revisions.find((r) => Date.parse(r.date) <= time) ?? noCommit(point);
    }
    const tagged = revisions.find((r) => r.tags.includes(point));
    if (tagged) return tagged;
    if (/^[0-9a-f]{4,40}$/i.test(point)) {
      const matches = revisions.filter((r) => r.sha.startsWith(point.toLowerCase()));
      if (matches.length === 1) return matches[0]!;
      if (matches.length > 1) return { ok: false, code: "not_found", message: `"${point}" is the start of ${matches.length} Revisions' shas; give more of it.`, suggestions: matches.map((m) => m.sha).slice(0, 5) };
    }
    return noCommit(point, revisions.flatMap((r) => r.tags).slice(0, 5));
  };

  const fetchBundle = (sha: string) => {
    let pending = bundles.get(sha);
    if (!pending) {
      pending = (async () => {
        let raw: unknown;
        try {
          raw = JSON.parse(await read(pastBundlePath(sha)));
        } catch (error) {
          return unavailable(`The Bundle at ${sha.slice(0, 7)} can't be read from the site: ${reason(error)}`);
        }
        return migrateBundle(raw) ?? unavailable(`The Bundle at ${sha.slice(0, 7)} has a schema this Archidocs can't read or migrate.`);
      })();
      bundles.set(sha, pending);
      // A failure may be a host's hiccup; ask again next time.
      void pending.then((b) => "ok" in b && bundles.delete(sha));
    }
    return pending;
  };

  return {
    index,
    async at(point, current) {
      const commit = current.bundle.commit;
      if (commit && (point === commit || (/^[0-9a-f]{4,40}$/i.test(point) && commit.startsWith(point.toLowerCase())))) {
        return { ok: true, commit, snapshot: current };
      }
      const entry = await entryAt(point);
      if ("ok" in entry) return entry;
      if (entry.sha === commit) return { ok: true, commit, snapshot: current };
      if (entry.bundle === false) return unavailable(`The Bundle at ${entry.sha.slice(0, 7)} (${entry.date}) was not kept on this site.`);
      const bundle = await fetchBundle(entry.sha);
      if ("ok" in bundle) return bundle;
      return { ok: true, commit: entry.sha, snapshot: { bundle, issues: [] } };
    },
    async time(point, edge) {
      if (isDate(point)) return { ok: true, time: dateTime(point, edge) };
      const entry = await entryAt(point);
      return "ok" in entry ? entry : { ok: true, time: Date.parse(entry.date) };
    },
  };
}
