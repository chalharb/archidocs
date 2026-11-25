/**
 * The point grammar: how a tag, a sha (or its prefix), a day or a time names
 * a Revision. One reading for the viewer, MCP on a site and, through ticket
 * 05, a checkout, so a point names the same Revision everywhere.
 */

/** What `find` needs of a Revision; the index's `RevisionEntry` is one. */
export interface Dated {
  sha: string;
  /** ISO 8601, as git's `%cI` writes it. */
  date: string;
  tags: readonly string[];
}

/** The point grammar in one sentence, for every reference that takes a point. */
export const POINT_GRAMMAR = "a tag, a commit sha or its first 4 or more characters, or a date (`YYYY-MM-DD`) or time (ISO 8601, UTC unless it gives a zone)";

/** How many candidates or tags a failure carries. */
const MAX_LISTED = 5;

/** The Revision a point names, or why it names none. */
export type Found<R extends Dated> =
  | { ok: true; revision: R }
  /** `tags` to suggest; `first` is the first Revision when the point is a date or time before it. */
  | { ok: false; kind: "not_found"; tags: string[]; first?: R }
  /** `count` Revisions' shas start with the point; `candidates` are the newest 5 of them. */
  | { ok: false; kind: "ambiguous"; count: number; candidates: R[] };

/** A stretch of time in ms since the epoch: from `start` up to, but not including, `end`. */
export interface Span {
  start: number;
  end: number;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?$/;
const HEX = /^[0-9a-f]{4,64}$/i;
const DAY_MS = 86_400_000;

/**
 * The span a day or a time stands for, or undefined when the point is
 * neither. A day (`YYYY-MM-DD`) is the UTC day `[00:00Z, next 00:00Z)`; a
 * time is its one instant, read as UTC when it gives no zone.
 */
export function timeSpan(point: string): Span | undefined {
  const day = DAY.exec(point);
  if (day) {
    const start = Date.parse(`${point}T00:00:00Z`);
    // Date.parse takes 2026-02-30 as March 2nd; a day must read back as itself.
    if (Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== point) return undefined;
    return { start, end: start + DAY_MS };
  }
  const time = TIME.exec(point);
  if (!time) return undefined;
  const [, date, minutes, seconds = ":00", zone = "Z"] = time;
  const offset = zone.toUpperCase() === "Z" ? "Z" : `${zone.slice(0, 3)}:${zone.slice(-2)}`;
  const at = Date.parse(`${date}T${minutes}${seconds}${offset}`);
  if (Number.isNaN(at) || !timeSpan(date!)) return undefined;
  return instant(at);
}

const instant = (at: number): Span => ({ start: at, end: at + 1 });

/**
 * The Revision a point names, over Revisions listed newest first. In order:
 * 1. an exact tag: the newest Revision carrying it;
 * 2. a day or a time: the last Revision dated before the span's end;
 * 3. hex of 4 to 64 characters, any case: the one Revision whose sha starts with it.
 * Anything else, or nothing found, is `not_found`; hex that starts several shas is `ambiguous`.
 */
export function find<R extends Dated>(revisions: readonly R[], point: string): Found<R> {
  const tagged = revisions.find((r) => r.tags.includes(point));
  if (tagged) return { ok: true, revision: tagged };
  const span = timeSpan(point);
  if (span) {
    const last = revisions.find((r) => Date.parse(r.date) < span.end);
    if (last) return { ok: true, revision: last };
    return notFound(revisions, revisions.at(-1));
  }
  if (HEX.test(point)) {
    const prefix = point.toLowerCase();
    const matches = revisions.filter((r) => r.sha.toLowerCase().startsWith(prefix));
    if (matches.length === 1) return { ok: true, revision: matches[0]! };
    if (matches.length > 1) return { ok: false, kind: "ambiguous", count: matches.length, candidates: matches.slice(0, MAX_LISTED) };
  }
  return notFound(revisions);
}

function notFound<R extends Dated>(revisions: readonly R[], first?: R): Found<R> {
  return { ok: false, kind: "not_found", tags: revisions.flatMap((r) => r.tags).slice(0, MAX_LISTED), ...(first ? { first } : {}) };
}

/**
 * The time a point spans, for `since`/`until`/`at` filters: a tag or a sha
 * spans its Revision's one instant, a day its whole UTC day, a time its one
 * instant. A day or time spans itself even with no Revision in or before it.
 * Keep a Revision dated `>=` the `since` span's start and `<` the `until` span's end.
 */
export function span<R extends Dated>(revisions: readonly R[], point: string): { ok: true; span: Span } | Exclude<Found<R>, { ok: true }> {
  const tagged = revisions.find((r) => r.tags.includes(point));
  if (!tagged) {
    const own = timeSpan(point);
    if (own) return { ok: true, span: own };
  }
  const found = find(revisions, point);
  return found.ok ? { ok: true, span: instant(Date.parse(found.revision.date)) } : found;
}
