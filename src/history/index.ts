import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { changedIds, countChanges, diff, load, serializeBundle, type ChangeCounts } from "../core/index.ts";
import { Bundle, SCHEMA_VERSION } from "../schema/bundle.ts";
import { commitInfo, defaultBranch, firstParentCommitsTouching, gitFileSystem, isDate, joinRepo, resolvePoint, tagsByCommit, type CommitInfo } from "./git.ts";

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

/** A point in time that names no commit, or history that can't be read. */
export class HistoryError extends Error {}

/** The Bundle of a commit with no Workspace, or before the first Revision: an empty Model. */
export function emptyBundle(commit: string | null, builtAt: string | null): Bundle {
  return { schemaVersion: SCHEMA_VERSION, commit, builtAt, teams: [], environments: [], projects: [], elements: [], relationships: [], targets: [], deployments: [], views: [], adrs: [] };
}
