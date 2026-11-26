import { bundleAt, buildHistory, readIndex, resolvePoint, type History } from "../history/index.ts";
import { find, INDEX_PATH, span, timeSpan, type Dated, type Found, type RevisionEntry, type Span } from "../revisions/index.ts";
import { commitInfo } from "../history/git.ts";
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
  /** The time a point spans: a commit's one instant, a whole UTC day, or a time's instant. */
  span(point: string): Promise<{ ok: true; span: Span } | PastFailure>;
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

/** `find`'s failure in MCP's words: no Revision (naming the first one for a date before it), or a prefix of several. */
function findFailure(point: string, failure: Exclude<Found<Dated>, { ok: true }>): PastFailure {
  if (failure.kind === "ambiguous") {
    return { ok: false, code: "not_found", message: `"${point}" is the start of ${failure.count} Revisions' shas; give more of it.`, suggestions: failure.candidates.map((r) => r.sha) };
  }
  const missing = noCommit(point, failure.tags);
  return failure.first ? { ...missing, message: `${missing.message} The first Revision is ${failure.first.sha.slice(0, 7)}, ${failure.first.date}.` } : missing;
}

function checkoutPast(source: CheckoutSource): Past {
  const repo = async (): Promise<History | undefined> => (await source.checkout.repo())?.history;
  const noGit = unavailable(`The Workspace at ${source.root} is not in a git repository, so it has no history.`);

  return {
    async at(point) {
      const h = await repo();
      if (!h) return noGit;
      const resolved = await resolvePoint(h, point);
      if (!resolved.ok) return findFailure(point, resolved);
      const { sha } = resolved;
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
    async span(point) {
      // A ref spans its commit's instant, a tag that looks like a date included;
      // otherwise a day or a time spans itself, as on a site.
      const own = timeSpan(point);
      const h = await repo();
      if (!h) return own ? { ok: true, span: own } : noGit;
      const resolved = await resolvePoint(h, point);
      if (own && !(resolved.ok && resolved.ref)) return { ok: true, span: own };
      if (!resolved.ok) return findFailure(point, resolved);
      const at = Date.parse((await commitInfo(h.repoRoot, resolved.sha)).date);
      return { ok: true, span: { start: at, end: at + 1 } };
    },
  };
}

function bundlePast(source: BundleSource): Past {
  const { site } = source;

  const index: Past["index"] = async () => {
    const read = await site.index();
    if (!read.ok) return unavailable(read.message);
    if (!read.index) return unavailable(`The site has no Revision index (${INDEX_PATH}), so it has no history.`);
    return { ok: true, revisions: read.index.revisions };
  };

  return {
    index,
    async at(point, current) {
      const commit = current.bundle.commit;
      // The current commit answers without the index; a prefix of it does unless the index says it starts other shas too.
      if (commit && point === commit) return { ok: true, commit, snapshot: current };
      const startsCommit = !!commit && /^[0-9a-f]{4,64}$/i.test(point) && commit.startsWith(point.toLowerCase());
      const listed = await index();
      if (!listed.ok) return startsCommit ? { ok: true, commit: commit!, snapshot: current } : listed;
      const found = find(listed.revisions, point);
      if (!found.ok) return found.kind === "not_found" && startsCommit ? { ok: true, commit: commit!, snapshot: current } : findFailure(point, found);
      const entry = found.revision;
      if (entry.sha === commit) return { ok: true, commit, snapshot: current };
      const past = await site.bundle(entry);
      if (!past.ok) return unavailable(past.message);
      return { ok: true, commit: entry.sha, snapshot: { bundle: past.bundle, issues: [] } };
    },
    async span(point) {
      // Tags come first, so read the index; a day or a time still spans itself without one.
      const listed = await index();
      if (!listed.ok) {
        const own = timeSpan(point);
        return own ? { ok: true, span: own } : listed;
      }
      const spanned = span(listed.revisions, point);
      return spanned.ok ? spanned : findFailure(point, spanned);
    },
  };
}
