import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { changedIds, countChanges, diff, load, serializeBundle, type ChangeCounts } from "../core/index.ts";
import { Bundle, SCHEMA_VERSION } from "../schema/bundle.ts";
import { commitInfo, defaultBranch, git, firstParentCommitsTouching, gitFileSystem, isDate, joinRepo, resolvePoint, tagsByCommit, type CommitInfo } from "./git.ts";

export { migrateBundle, migrations, type Migration } from "./migrate.ts";
export { resolvePoint, isDate, type CommitInfo } from "./git.ts";

/** The cache a checkout keeps past Bundles and their index entries in, under the repo root. */
export const CACHE_DIR = join(".archidocs", "cache");

/** Where a Workspace's history lives: its git repo and the Workspace root within it. */
export interface History {
  repoRoot: string;
  /** The Workspace root relative to the repo root, with `/` separators; "" when they are the same folder. */
  workspacePath: string;
}

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

export interface RevisionIndex {
  schemaVersion: number;
  /** Newest first. */
  revisions: RevisionEntry[];
}

export const history = (repoRoot: string, workspaceRoot: string): History => ({
  repoRoot,
  workspacePath: relative(repoRoot, workspaceRoot).split(sep).join("/"),
});

const bundlesDir = (h: History) => join(h.repoRoot, CACHE_DIR, "bundles");
const bundleFile = (h: History, sha: string) => join(bundlesDir(h), `${sha}.json`);
const indexFile = (h: History) => join(bundlesDir(h), "index.json");

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
    if (index.schemaVersion === SCHEMA_VERSION && Array.isArray(index.revisions)) return index;
  } catch {
    // No index yet, or an unreadable one: start again.
  }
  return { schemaVersion: SCHEMA_VERSION, revisions: [] };
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
    await writeFile(indexFile(h), JSON.stringify({ schemaVersion: SCHEMA_VERSION, revisions: revisionsOut }, null, 2) + "\n");
  }
  return { revisions: inScope.length, built };
}

async function sinceTime(h: History, since: string): Promise<number> {
  if (/^\d{4}-\d{2}-\d{2}$/.test(since)) return Date.parse(`${since}T00:00:00Z`);
  if (isDate(since)) return Date.parse(since);
  const sha = await resolvePoint(h.repoRoot, since);
  if (!sha) throw new HistoryError(`Unknown ref or date "${since}".`);
  return Date.parse((await commitInfo(h.repoRoot, sha)).date);
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
  const dir = join(out, "bundles");
  const hasCommits = await gitHasCommits(h.repoRoot);
  if (hasCommits) await buildHistory(h);
  const index = hasCommits ? await readIndex(h) : { schemaVersion: SCHEMA_VERSION, revisions: [] };
  const revisionsOut = index.revisions.map((entry, i) => ({ ...entry, bundle: keep === "all" || i < keep || entry.tags.length > 0 }));
  await mkdir(dir, { recursive: true });
  const keptFiles = new Set(revisionsOut.filter((e) => e.bundle).map((e) => `${e.sha}.json`));
  for (const file of await readdir(dir)) {
    if (/^[0-9a-f]{40,64}\.json$/.test(file) && !keptFiles.has(file)) await rm(join(dir, file));
  }
  for (const file of keptFiles) await copyFile(join(bundlesDir(h), file), join(dir, file));
  await writeFile(join(dir, "index.json"), JSON.stringify({ schemaVersion: SCHEMA_VERSION, revisions: revisionsOut }, null, 2) + "\n");
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

/** What a preview site's `bundles/index.json` adds: the base branch and both sides' shas, so the viewer opens with Compare "base → PR". */
export interface PreviewMark {
  base: string;
  baseSha: string;
  headSha: string;
}

/**
 * Writes a preview site's `bundles/`: the base's Bundle, the head's (the
 * checkout as built) and an index of the two, newest first, marked with
 * `preview`. The head's counts are against the base.
 */
export async function publishPreview(h: History, out: string, sides: PreviewSides, head: Bundle): Promise<PreviewMark> {
  const dir = join(out, "bundles");
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
  await writeFile(join(dir, `${baseRevision.sha}.json`), serializeBundle(baseBundle));
  await writeFile(join(dir, `${sides.head.sha}.json`), serializeBundle(head));
  await writeFile(join(dir, "index.json"), JSON.stringify({ schemaVersion: SCHEMA_VERSION, preview, revisions: revisionsOut }, null, 2) + "\n");
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
