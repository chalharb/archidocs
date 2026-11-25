import { diff as diffBundles, type Change } from "../core/index.ts";
import { bundleAt, resolvePoint } from "../history/index.ts";
import type { Bundle } from "../schema/bundle.ts";
import type { Checkout } from "../workspace/index.ts";

/** One side of a diff: the point as given and the commit it resolved to (null for the working tree). */
export interface DiffSide {
  point: string;
  commit: string | null;
}

export type DiffResult =
  /** History needs the Workspace in a git repo. */
  | { kind: "not-in-git" }
  /** A point names no commit: an unknown ref, or a date before the default branch's first commit. */
  | { kind: "unknown-point"; point: string }
  | { kind: "ok"; from: DiffSide; to: DiffSide; changes: Change[] };

/** The Changes between two points in history (refs or dates); a missing `to` is the working tree. */
export async function diff(checkout: Checkout, points: { from: string; to?: string }): Promise<DiffResult> {
  const repo = await checkout.repo();
  if (!repo) return { kind: "not-in-git" };
  const h = repo.history;
  /** A point's Bundle; with no point, the working tree's. */
  const side = async (point: string | undefined): Promise<[DiffSide, Bundle] | undefined> => {
    if (point === undefined) return [{ point: "working tree", commit: null }, (await checkout.load()).bundle];
    const commit = await resolvePoint(h.repoRoot, point);
    return commit ? [{ point, commit }, (await bundleAt(h, commit)).bundle] : undefined;
  };
  const from = await side(points.from);
  if (!from) return { kind: "unknown-point", point: points.from };
  const to = await side(points.to);
  if (!to) return { kind: "unknown-point", point: points.to! };
  return { kind: "ok", from: from[0], to: to[0], changes: diffBundles(from[1], to[1]) };
}
