import { migrateBundle } from "../../src/history/migrate.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { INDEX_PATH, pastBundlePath, type PreviewMark, type RevisionEntry } from "../../src/revisions/index.ts";

/** The site's Revisions, newest first; empty when the site has no history. */
export class Timeline {
  readonly revisions: readonly RevisionEntry[];
  /** Set on a PR preview site, which opens with Compare "base → PR". */
  readonly preview: PreviewMark | undefined;

  constructor(revisions: readonly RevisionEntry[], preview?: PreviewMark) {
    this.revisions = revisions;
    this.preview = preview;
  }

  /** On a preview site, the base's Revision, which Compare starts from. */
  previewBase(): RevisionEntry | undefined {
    return this.preview && this.revisions.find((r) => r.sha === this.preview!.baseSha);
  }

  /** How Compare names its sides: "main → PR" on a preview's own two sides, else "v1 → latest". */
  compareLabel(vs: RevisionEntry, at: RevisionEntry | undefined): string {
    const head = at === undefined || at.sha === this.preview?.headSha;
    if (this.preview && vs.sha === this.preview.baseSha && head) return `${this.preview.base} → PR`;
    return `${pointLabel(vs)} → ${at ? pointLabel(at) : "latest"}`;
  }

  /**
   * The Revision a point names: a tag, a sha or its prefix (at least 4
   * characters), or a date (`YYYY-MM-DD`), which is the last Revision at or
   * before the end of that day (UTC).
   */
  find(point: string): RevisionEntry | undefined {
    if (/^\d{4}-\d{2}-\d{2}$/.test(point)) {
      const end = Date.parse(`${point}T23:59:59.999Z`);
      return this.revisions.find((r) => Date.parse(r.date) <= end);
    }
    return this.revisions.find((r) => r.tags.includes(point)) ?? (point.length >= 4 ? this.revisions.find((r) => r.sha.startsWith(point.toLowerCase())) : undefined);
  }

  /** The Revision before this one, if any. */
  previous(revision: RevisionEntry): RevisionEntry | undefined {
    return this.revisions[this.revisions.indexOf(revision) + 1];
  }

  /** Whether a Revision is the latest one, which the site's `workspace.bundle.json` shows. */
  isLatest(revision: RevisionEntry): boolean {
    return this.revisions[0] === revision;
  }

  /** The Revisions whose changed ids hold any of these ids, newest first. */
  touching(ids: ReadonlySet<string>): RevisionEntry[] {
    return this.revisions.filter((r) => r.changedIds.some((id) => ids.has(id)));
  }
}

/** How a Revision reads in the URL and on chips: its first tag, else its short sha. */
export const pointLabel = (revision: RevisionEntry) => revision.tags[0] ?? revision.sha.slice(0, 7);
export const shortDate = (revision: RevisionEntry) => revision.date.slice(0, 10);

/** Loads `bundles/index.json`; a site without one has no history. */
export async function loadTimeline(): Promise<Timeline> {
  try {
    const r = await fetch(`./${INDEX_PATH}`);
    if (!r.ok) return new Timeline([]);
    const index = (await r.json()) as { revisions?: RevisionEntry[]; preview?: PreviewMark };
    return new Timeline(Array.isArray(index.revisions) ? index.revisions : [], typeof index.preview?.baseSha === "string" ? index.preview : undefined);
  } catch {
    return new Timeline([]);
  }
}

/** A past Bundle the site can't give: dropped by retention, missing, or from a schema this viewer can't migrate. */
export class HistoryUnavailable extends Error {
  readonly code = "history_unavailable";
}

const bundles = new Map<string, Promise<Bundle>>();

/** A past Bundle from `bundles/<sha>.json`, migrated to this viewer's schema; fetched once per sha (each file is immutable). */
export function loadBundle(revision: RevisionEntry): Promise<Bundle> {
  if (!revision.bundle) return Promise.reject(new HistoryUnavailable("this site no longer keeps its Bundle"));
  let pending = bundles.get(revision.sha);
  if (!pending) {
    pending = fetch(`./${pastBundlePath(revision.sha)}`).then(async (r) => {
      if (!r.ok) throw new HistoryUnavailable(`${pastBundlePath(revision.sha)}: HTTP ${r.status}`);
      const bundle = migrateBundle(await r.json());
      if (!bundle) throw new HistoryUnavailable("its Bundle is from a schema this viewer can't read");
      return bundle;
    });
    pending.catch(() => bundles.delete(revision.sha));
    bundles.set(revision.sha, pending);
  }
  return pending;
}
