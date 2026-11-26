import type { Bundle } from "../../src/schema/bundle.ts";
import { fetchReader, find, openSite, type Found, type PreviewMark, type RevisionEntry, type UnavailableReason } from "../../src/revisions/index.ts";

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

  /** The Revision a point names, by the module's point grammar, or why it names none. */
  find(point: string): Found<RevisionEntry> {
    return find(this.revisions, point);
  }

  /** The Revision before this one, if any. */
  previous(revision: RevisionEntry): RevisionEntry | undefined {
    return this.revisions[this.revisions.indexOf(revision) + 1];
  }

  /** Whether a Revision is the latest one, which the site's `workspace.bundle.json` shows. */
  isLatest(revision: RevisionEntry): boolean {
    return this.revisions[0] === revision;
  }
}

/** How a Revision reads in the URL and on chips: its first tag, else its short sha. */
export const pointLabel = (revision: RevisionEntry) => revision.tags[0] ?? revision.sha.slice(0, 7);
export const shortDate = (revision: RevisionEntry) => revision.date.slice(0, 10);

/**
 * The site next to index.html, read once per page load; relative URLs, so
 * the site works under any base path.
 */
export const site = openSite(fetchReader("./"), { recheckMs: Infinity });

/** Loads `bundles/index.json`; a site without one, or with one this viewer can't read, has no history. */
export async function loadTimeline(): Promise<Timeline> {
  const read = await site.index();
  return read.ok && read.index ? new Timeline(read.index.revisions, read.index.preview) : new Timeline([]);
}

/** How the viewer words each reason the module gives for a Bundle it can't have. */
const REASONS: Record<UnavailableReason, string> = {
  dropped: "this site no longer keeps its Bundle",
  missing: "its Bundle is missing from this site",
  unreadable: "its Bundle can't be read",
  unmigratable: "its Bundle is from a schema this viewer can't read",
  index: "this site's Revision index can't be read",
};

/** A past Bundle the site can't give: dropped by retention, missing, or from a schema this viewer can't migrate. */
export class HistoryUnavailable extends Error {
  readonly code = "history_unavailable";
  /** The module's reason, which the message words for the screen. */
  readonly reason: UnavailableReason;
  constructor(reason: UnavailableReason) {
    super(REASONS[reason]);
    this.reason = reason;
  }
}

/** A past Bundle from `bundles/<sha>.json`, migrated to this viewer's schema; fetched once per sha (each file is immutable). */
export async function loadBundle(revision: RevisionEntry): Promise<Bundle> {
  const read = await site.bundle(revision);
  if (!read.ok) throw new HistoryUnavailable(read.reason);
  return read.bundle;
}
