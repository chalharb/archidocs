import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { changedIds, countChanges, diff, load, serializeBundle } from "../core/index.ts";
import { Bundle, SCHEMA_VERSION } from "../schema/bundle.ts";
import { git } from "../git.ts";
import { BUNDLES_DIR, INDEX_PATH, INDEX_VERSION, isPastBundleFile, pastBundleFile, timeSpan, type PreviewMark, type RevisionEntry, type RevisionIndex } from "../revisions/index.ts";
import { commitInfo, defaultBranch, firstParentCommitsTouching, gitFileSystem, joinRepo, tagsByCommit, type CommitInfo } from "./git.ts";
import { pointMessage, resolvePoint } from "./points.ts";

export { migrateBundle, migrations, type Migration } from "../revisions/index.ts";
export { type CommitInfo } from "./git.ts";
export { resolvePoint, pointMessage, type PointFailure, type ResolvedPoint } from "./points.ts";

/** The cache a checkout keeps past Bundles and their index entries in, under the repo root. */
export const CACHE_DIR = join(".archidocs", "cache");

/** Where a Workspace's history lives: its git repo and the Workspace root within it. */
export interface History {
  repoRoot: string;
  /** The Workspace root relative to the repo root, with `/` separators; "" when they are the same folder. */
  workspacePath: string;
}

export const history = (repoRoot: string, workspaceRoot: string): History => ({
  repoRoot,
  workspacePath: relative(repoRoot, workspaceRoot).split(sep).join("/"),
});

const bundlesDir = (h: History) => join(h.repoRoot, CACHE_DIR, BUNDLES_DIR);
const bundleFile = (h: History, sha: string) => join(bundlesDir(h), pastBundleFile(sha));
const indexFile = (h: History) => join(h.repoRoot, CACHE_DIR, INDEX_PATH);

/**
 * The Revisions: first-parent default-branch commits that changed something
 * under the Workspace root, newest first.
 */
export async function revisions(h: History): Promise<CommitInfo[]> {
  return firstParentCommitsTouching(h.repoRoot, await defaultBranch(h.repoRoot), h.workspacePath);
}

/**
 * Builds the Bundle at one commit by reading the Workspace's files there
 * with git, with no worktree. A commit without the Workspace has an empty
 * Model. Issues are not reported: a past Bundle is what was there.
 */
export async function buildBundleAt(h: History, sha: string): Promise<Bundle> {
  const fs = await gitFileSystem(h.repoRoot, sha);
  const { date } = await commitInfo(h.repoRoot, sha);
  const root = joinRepo(h.repoRoot, h.workspacePath);
  if (!(await fs.exists(join(root, "workspace.yaml")))) return emptyBundle(sha, date);
  return (await load({ fs, root, repoRoot: h.repoRoot, commit: sha, builtAt: date })).bundle;
}

/**
 * The Bundle at one commit from the cache, built and cached when missing.
 * A cached Bundle from another `schemaVersion` is rebuilt with this
 * Archidocs and overwritten, never compared raw.
 */
export async function bundleAt(h: History, sha: string): Promise<{ bundle: Bundle; built: boolean }> {
  const cached = await readCached(h, sha);
  if (cached) return { bundle: cached, built: false };
  const bundle = await buildBundleAt(h, sha);
  await mkdir(bundlesDir(h), { recursive: true });
  await writeFile(bundleFile(h, sha), serializeBundle(bundle));
  return { bundle, built: true };
}

async function readCached(h: History, sha: string): Promise<Bundle | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(bundleFile(h, sha), "utf8"));
  } catch {
    return undefined;
  }
  if ((raw as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION) return undefined;
  const parsed = Bundle.safeParse(raw);
  return parsed.success && parsed.data.commit === sha ? parsed.data : undefined;
}

export async function readIndex(h: History): Promise<RevisionIndex> {
  try {
    const index = JSON.parse(await readFile(indexFile(h), "utf8")) as RevisionIndex;
    if (index.schemaVersion === INDEX_VERSION && Array.isArray(index.revisions)) return index;
  } catch {
    // No index yet, or an unreadable one: start again.
  }
  return { schemaVersion: INDEX_VERSION, revisions: [] };
}

export interface BuildResult {
  /** Revisions in scope, and how many of them needed a Bundle or index entry built. */
  revisions: number;
  built: number;
}

/**
 * Backfills cached Bundles and index entries for every Revision, or those
 * at or after `since` (a ref's commit time, or the start of a date).
 * Idempotent: a Revision whose entry and Bundle are already cached is
 * skipped, so a second run builds nothing.
 */
export async function buildHistory(h: History, options: { since?: string } = {}): Promise<BuildResult> {
  const all = await revisions(h);
  const since = options.since === undefined ? undefined : await sinceTime(h, options.since);
  const inScope = since === undefined ? all : all.filter((r) => Date.parse(r.date) >= since);
  const index = await readIndex(h);
  const entries = new Map(index.revisions.map((e) => [e.sha, e]));
  const tags = await tagsByCommit(h.repoRoot);
  let built = 0;
  let changed = false;

  for (const rev of [...inScope].reverse()) {
    const entry = entries.get(rev.sha);
    const cached = entry ? await readCached(h, rev.sha) : undefined;
    if (entry && cached) continue;
    const { bundle } = await bundleAt(h, rev.sha);
    const previous = all[all.indexOf(rev) + 1];
    const before = previous ? (await bundleAt(h, previous.sha)).bundle : emptyBundle(null, null);
    const changes = diff(before, bundle);
    entries.set(rev.sha, { ...rev, tags: [], counts: countChanges(changes), changedIds: changedIds(changes), bundle: true });
    built++;
    changed = true;
  }

  // Tags move independently of commits, so refresh them on every run.
  for (const [sha, entry] of entries) {
    const now = tags.get(sha) ?? [];
    if (JSON.stringify(now) !== JSON.stringify(entry.tags)) {
      entries.set(sha, { ...entry, tags: now });
      changed = true;
    }
  }
  if (changed) {
    const order = new Map(all.map((r, i) => [r.sha, i]));
    const revisionsOut = [...entries.values()]
      .filter((e) => order.has(e.sha))
      .sort((a, b) => order.get(a.sha)! - order.get(b.sha)!)
      .map(({ sha, date, subject, author, tags: t, counts, changedIds: ids, bundle }) => ({ sha, date, subject, author, tags: t, counts, changedIds: ids, bundle }));
    await mkdir(dirname(indexFile(h)), { recursive: true });
    await writeFile(indexFile(h), JSON.stringify({ schemaVersion: INDEX_VERSION, revisions: revisionsOut }, null, 2) + "\n");
  }
  return { revisions: inScope.length, built };
}

/** Where `--since` starts: a day's start, a time as given (UTC without a zone), else the commit date of the commit the point names. */
async function sinceTime(h: History, since: string): Promise<number> {
  const own = timeSpan(since);
  if (own) return own.start;
  const point = await resolvePoint(h, since);
  if (!point.ok) throw new HistoryError(pointMessage(since, point));
  return Date.parse((await commitInfo(h.repoRoot, point.sha)).date);
}

/** Past Bundles a published site keeps by default: the latest 200 Revisions, plus every tagged one. */
export const DEFAULT_KEEP = 200;

export interface PublishResult {
  revisions: number;
  kept: number;
}

/**
 * Writes the site's `bundles/` folder: `bundles/<sha>.json` for each kept
 * Revision and `bundles/index.json` listing every Revision. Kept are the
 * latest `keep` Revisions plus every tagged one; the others stay in the
 * index with `bundle: false`. Bundles come from the checkout's cache,
 * backfilled from git first, so nothing is fetched. A Bundle file left in
 * the folder by an earlier build is removed once its Revision is dropped.
 */
export async function publishHistory(h: History, out: string, { keep = DEFAULT_KEEP }: { keep?: number | "all" } = {}): Promise<PublishResult> {
  const dir = join(out, BUNDLES_DIR);
  const hasCommits = await gitHasCommits(h.repoRoot);
  if (hasCommits) await buildHistory(h);
  const index = hasCommits ? await readIndex(h) : { schemaVersion: INDEX_VERSION, revisions: [] };
  const revisionsOut = index.revisions.map((entry, i) => ({ ...entry, bundle: keep === "all" || i < keep || entry.tags.length > 0 }));
  await mkdir(dir, { recursive: true });
  const keptFiles = new Set(revisionsOut.filter((e) => e.bundle).map((e) => pastBundleFile(e.sha)));
  for (const file of await readdir(dir)) {
    if (isPastBundleFile(file) && !keptFiles.has(file)) await rm(join(dir, file));
  }
  for (const file of keptFiles) await copyFile(join(bundlesDir(h), file), join(dir, file));
  await writeFile(join(out, INDEX_PATH), JSON.stringify({ schemaVersion: INDEX_VERSION, revisions: revisionsOut }, null, 2) + "\n");
  return { revisions: revisionsOut.length, kept: keptFiles.size };
}

/** The two sides a preview site Compares: the base branch's latest Revision and the PR head. */
export interface PreviewSides {
  /** The base branch's name, such as `main`; its Revision is read from `origin/<base>`. */
  base: string;
  baseRevision: CommitInfo;
  baseBundle: Bundle;
  /** The Bundle of the Revision before the base's, for the base entry's counts. */
  beforeBase: Bundle;
  head: CommitInfo;
}

/**
 * Finds a preview's sides from what the checkout already has: the latest
 * Revision on `origin/<base>` (or its tip, when the base has no Revision
 * yet) and HEAD. It never fetches; a missing `origin/<base>` is an error.
 */
export async function previewSides(h: History, base: string): Promise<PreviewSides> {
  const ref = `refs/remotes/origin/${base}`;
  const tip = (await git(h.repoRoot, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`).catch(() => "")).trim();
  if (!tip) throw new HistoryError(`origin/${base} is not in this checkout; fetch the base branch before building (archidocs never fetches).`);
  const headSha = (await git(h.repoRoot, "rev-parse", "--verify", "--quiet", "HEAD^{commit}").catch(() => "")).trim();
  if (!headSha) throw new HistoryError("A preview needs HEAD to be a commit.");
  const onBase = await firstParentCommitsTouching(h.repoRoot, ref, h.workspacePath);
  const baseRevision = onBase[0] ?? (await commitInfo(h.repoRoot, tip));
  const before = onBase[1];
  return {
    base,
    baseRevision,
    baseBundle: (await bundleAt(h, baseRevision.sha)).bundle,
    beforeBase: before ? (await bundleAt(h, before.sha)).bundle : emptyBundle(null, null),
    head: await commitInfo(h.repoRoot, headSha),
  };
}

/**
 * Writes a preview site's `bundles/`: the base's Bundle, the head's (the
 * checkout as built) and an index of the two, newest first, marked with
 * `preview`. The head's counts are against the base.
 */
export async function publishPreview(h: History, out: string, sides: PreviewSides, head: Bundle): Promise<PreviewMark> {
  const dir = join(out, BUNDLES_DIR);
  const tags = await tagsByCommit(h.repoRoot);
  const entry = (rev: CommitInfo, before: Bundle, after: Bundle): RevisionEntry => {
    const changes = diff(before, after);
    const { sha, date, subject, author } = rev;
    return { sha, date, subject, author, tags: tags.get(sha) ?? [], counts: countChanges(changes), changedIds: changedIds(changes), bundle: true };
  };
  const { baseRevision, baseBundle } = sides;
  const revisionsOut = [entry(sides.head, baseBundle, head)];
  if (sides.head.sha !== baseRevision.sha) revisionsOut.push(entry(baseRevision, sides.beforeBase, baseBundle));
  const preview = { base: sides.base, baseSha: baseRevision.sha, headSha: sides.head.sha };
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, pastBundleFile(baseRevision.sha)), serializeBundle(baseBundle));
  await writeFile(join(dir, pastBundleFile(sides.head.sha)), serializeBundle(head));
  await writeFile(join(out, INDEX_PATH), JSON.stringify({ schemaVersion: INDEX_VERSION, preview, revisions: revisionsOut }, null, 2) + "\n");
  return preview;
}

/** The base branch origin/HEAD names, else `main`. */
export async function defaultBaseBranch(repoRoot: string): Promise<string> {
  const ref = (await git(repoRoot, "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD").catch(() => "")).trim();
  return ref.startsWith("refs/remotes/origin/") ? ref.slice("refs/remotes/origin/".length) : "main";
}

async function gitHasCommits(repoRoot: string): Promise<boolean> {
  return git(repoRoot, "rev-parse", "--verify", "--quiet", "HEAD^{commit}").then(
    () => true,
    () => false,
  );
}

/** A point in time that names no commit, or history that can't be read. */
export class HistoryError extends Error {}

/** The Bundle of a commit with no Workspace, or before the first Revision: an empty Model. */
export function emptyBundle(commit: string | null, builtAt: string | null): Bundle {
  return { schemaVersion: SCHEMA_VERSION, commit, builtAt, teams: [], environments: [], projects: [], elements: [], relationships: [], targets: [], deployments: [], views: [], adrs: [] };
}
