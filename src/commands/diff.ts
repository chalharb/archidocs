import { diff as diffBundles, type Change } from "../core/index.ts";
import { bundleAt, resolvePoint, type PointFailure } from "../history/index.ts";
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
  /** A point names no commit: an unknown ref, a date before the first Revision, or a prefix of several Revisions' shas. */
  | { kind: "unknown-point"; point: string; failure: PointFailure }
  | { kind: "ok"; from: DiffSide; to: DiffSide; changes: Change[] };

/** The Changes between two points in history (refs or dates); a missing `to` is the working tree. */
export async function diff(checkout: Checkout, points: { from: string; to?: string }): Promise<DiffResult> {
  const repo = await checkout.repo();
  if (!repo) return { kind: "not-in-git" };
  const h = repo.history;
  /** A point's Bundle; with no point, the working tree's. */
  const side = async (point: string | undefined): Promise<{ ok: true; side: DiffSide; bundle: Bundle } | { ok: false; result: DiffResult }> => {
    if (point === undefined) return { ok: true, side: { point: "working tree", commit: null }, bundle: (await checkout.load()).bundle };
    const resolved = await resolvePoint(h, point);
    if (!resolved.ok) return { ok: false, result: { kind: "unknown-point", point, failure: resolved } };
    return { ok: true, side: { point, commit: resolved.sha }, bundle: (await bundleAt(h, resolved.sha)).bundle };
  };
  const from = await side(points.from);
  if (!from.ok) return from.result;
  const to = await side(points.to);
  if (!to.ok) return to.result;
  return { kind: "ok", from: from.side, to: to.side, changes: diffBundles(from.bundle, to.bundle) };
}
