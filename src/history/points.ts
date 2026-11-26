import { git } from "../git.ts";
import { find, type Dated, type Found } from "../revisions/index.ts";
import { defaultBranch, firstParentCommitsTouching, tagsByCommit } from "./git.ts";
import type { History } from "./index.ts";

/** Why a point names no commit on a checkout: `find`'s failure over the default branch's Revisions. */
export type PointFailure = Exclude<Found<Dated>, { ok: true }>;

/** The commit a point names; `ref` is true when git resolved it as a ref, false when it named a Revision by date or sha prefix. */
export type ResolvedPoint = { ok: true; sha: string; ref: boolean } | PointFailure;

/**
 * Resolves a point on a checkout to a commit, in this order:
 * 1. a git ref (tag, branch, sha, `HEAD~1`), to its commit, Revision or not;
 * 2. a date or a time, to the last Revision on the default branch at or before it;
 * 3. hex, to the one Revision whose sha starts with it (several are `ambiguous`).
 * Anything else is `not_found`, suggesting up to 5 tags. Dates and hex go
 * through the point grammar's `find`, so they name what they name on a site.
 */
export async function resolvePoint(h: History, point: string): Promise<ResolvedPoint> {
  const sha = await revParse(h.repoRoot, point);
  if (sha) return { ok: true, sha, ref: true };
  const [commits, tags] = await Promise.all([defaultBranch(h.repoRoot).then((branch) => firstParentCommitsTouching(h.repoRoot, branch, h.workspacePath)), tagsByCommit(h.repoRoot)]);
  const revisions: Dated[] = commits.map(({ sha, date }) => ({ sha, date, tags: tags.get(sha) ?? [] }));
  const found = find(revisions, point);
  return found.ok ? { ok: true, sha: found.revision.sha, ref: false } : found;
}

/** The CLI's words for a point that names no commit, after `archidocs: `. */
export function pointMessage(point: string, failure: PointFailure): string {
  if (failure.kind === "ambiguous") return `"${point}" is the start of ${failure.count} Revisions' shas; give more of it.`;
  const message = `Unknown ref or date "${point}"; a date names the last Revision at or before it.`;
  return failure.first ? `${message} The first Revision is ${failure.first.sha.slice(0, 7)}, ${failure.first.date}.` : message;
}

const revParse = async (repoRoot: string, point: string): Promise<string | undefined> =>
  (await git(repoRoot, "rev-parse", "--verify", "--quiet", "--end-of-options", `${point}^{commit}`).catch(() => "")).trim() || undefined;
