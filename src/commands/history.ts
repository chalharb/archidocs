import { buildHistory as buildRevisions } from "../history/index.ts";
import type { Checkout } from "../workspace/index.ts";

export interface BuildHistoryOptions {
  /** Only Revisions at or after this ref or date. */
  since?: string;
}

export type BuildHistoryResult =
  /** History needs the Workspace in a git repo. */
  | { kind: "not-in-git" }
  /** How many Revisions are in scope, and how many of those this run built. */
  | { kind: "ok"; revisions: number; built: number };

/** Builds and caches the Bundle of every Revision not yet built. */
export async function buildHistory(checkout: Checkout, options: BuildHistoryOptions = {}): Promise<BuildHistoryResult> {
  const repo = await checkout.repo();
  if (!repo) return { kind: "not-in-git" };
  const { revisions, built } = await buildRevisions(repo.history, options.since === undefined ? {} : { since: options.since });
  return { kind: "ok", revisions, built };
}
