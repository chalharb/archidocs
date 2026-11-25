import { useEffect, useMemo, useRef, useState } from "react";
import type { Change } from "../../src/core/diff.ts";
import type { Bundle } from "../../src/schema/bundle.ts";
import { formatPlace, type Place } from "./place.ts";
import { HistoryUnavailable, loadBundle, pointLabel, shortDate, type Timeline } from "./revisions.ts";
import type { RevisionEntry } from "../../src/revisions/index.ts";
import { Icon } from "./Icon.tsx";

/** The Bundles a place's `at` and `vs` name, once loaded; `before` only while Comparing. */
export interface Times {
  current: Bundle;
  before?: Bundle;
  /** The Revision `at` names; undefined for the latest. */
  at?: RevisionEntry;
  vs?: RevisionEntry;
}

/** Why a place's `at` or `vs` can't be shown. */
export type TimeProblem =
  | { kind: "unknown"; point: string }
  /** `point` starts several Revisions' shas; `side` says whether it came from `at` or `vs`. */
  | { kind: "ambiguous"; point: string; side: "at" | "vs"; candidates: RevisionEntry[] }
  | { kind: "unavailable"; revision: RevisionEntry; reason: string };

export type TimeState = { kind: "ready"; times: Times } | { kind: "problem"; problem: TimeProblem };

async function resolveTimes(latest: Bundle, timeline: Timeline, at: string | null, vs: string | null): Promise<TimeState> {
  const find = (point: string | null, side: "at" | "vs"): RevisionEntry | undefined | TimeState => {
    if (point === null) return undefined;
    const found = timeline.find(point);
    if (found.ok) return found.revision;
    const problem: TimeProblem = found.kind === "ambiguous" ? { kind: "ambiguous", point, side, candidates: found.candidates } : { kind: "unknown", point };
    return { kind: "problem", problem };
  };
  const atRevision = find(at, "at");
  if (atRevision && "kind" in atRevision) return atRevision;
  const vsRevision = find(vs, "vs");
  if (vsRevision && "kind" in vsRevision) return vsRevision;
  const load = async (revision: RevisionEntry | undefined) => (revision === undefined ? latest : loadBundle(revision));
  try {
    const current = await load(atRevision);
    try {
      const before = vsRevision === undefined ? undefined : await load(vsRevision);
      return { kind: "ready", times: { current, ...(before ? { before } : {}), ...(atRevision ? { at: atRevision } : {}), ...(vsRevision ? { vs: vsRevision } : {}) } };
    } catch (e) {
      return unavailable(vsRevision!, e);
    }
  } catch (e) {
    return unavailable(atRevision!, e);
  }
}

function unavailable(revision: RevisionEntry, e: unknown): TimeState {
  if (!(e instanceof HistoryUnavailable)) throw e;
  return { kind: "problem", problem: { kind: "unavailable", revision, reason: e.message } };
}

/**
 * The Bundles for a place's `at` and `vs`. While new ones load it keeps
 * returning the last ones it had, marked `loading`, so the screen stays put.
 */
export function useTimes(latest: Bundle, timeline: Timeline, at: string | null, vs: string | null): { state?: TimeState; loading: boolean } {
  const key = `${at ?? ""}\n${vs ?? ""}`;
  const now = at === null && vs === null;
  const [loaded, setLoaded] = useState<{ key: string; state: TimeState }>();
  const latestState = useMemo<TimeState>(() => ({ kind: "ready", times: { current: latest } }), [latest]);
  useEffect(() => {
    if (now) return;
    let live = true;
    void resolveTimes(latest, timeline, at, vs).then((state) => {
      if (live) setLoaded({ key, state });
    });
    return () => {
      live = false;
    };
    // key stands for at and vs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, timeline, key]);
  if (now) return { state: latestState, loading: false };
  if (loaded?.key === key) return { state: loaded.state, loading: false };
  return { state: loaded?.state.kind === "ready" ? loaded.state : undefined, loading: true };
}

/** Shown in place of the screen when `at` or `vs` names a Revision this site can't give. */
export function Unavailable({ problem, place }: { problem: TimeProblem; place: Place }) {
  const back = formatPlace({ ...place, at: null, vs: null, selected: null });
  if (problem.kind === "unknown") {
    return (
      <div className="arc-unavailable" role="alert">
        <h1>No Revision “{problem.point}”</h1>
        <p>This site's history has no tag, commit or date called {problem.point}.</p>
        <a href={back}>Back to latest</a>
      </div>
    );
  }
  if (problem.kind === "ambiguous") {
    return (
      <div className="arc-unavailable" role="alert">
        <h1>More than one Revision “{problem.point}”</h1>
        <p>The shas of these Revisions all start with {problem.point}. Pick one:</p>
        <ul>
          {problem.candidates.map((r) => (
            <li key={r.sha}>
              <a href={formatPlace({ ...place, [problem.side]: pointLabel(r) })}>
                <code>{r.sha.slice(0, 7)}</code> {r.subject} ({shortDate(r)})
              </a>
            </li>
          ))}
        </ul>
        <a href={back}>Back to latest</a>
      </div>
    );
  }
  const { revision } = problem;
  const sha = revision.sha.slice(0, 7);
  return (
    <div className="arc-unavailable" role="alert">
      <h1>
        <code>history_unavailable</code>
      </h1>
      <p>
        This site can't show {pointLabel(revision)} “{revision.subject}” ({shortDate(revision)}): {problem.reason}. It keeps full Bundles for the latest Revisions and every tag.
      </p>
      <p>
        On a checkout, run <code>archidocs diff {sha} HEAD</code>, or ask the MCP server with <code>at: "{sha}"</code>.
      </p>
      <a href={back}>Back to latest</a>
    </div>
  );
}

/** The banner over a past Revision, with a way back to the latest. */
export function AtBanner({ revision, place }: { revision: RevisionEntry; place: Place }) {
  return (
    <p className="arc-at" role="status" aria-label="Past Revision">
      <span>
        Viewing <strong>{pointLabel(revision)}</strong> · {revision.subject} · {shortDate(revision)}
      </span>
      <a href={formatPlace({ ...place, at: null })}>Back to latest</a>
    </p>
  );
}

const KIND_NAMES: Record<Change["kind"], string> = {
  team: "Team",
  environment: "Environment",
  project: "Project",
  element: "Element",
  relationship: "Relationship",
  target: "Deployment Target",
  deployment: "Deployment",
  view: "View",
  adr: "ADR",
};
const SIGNS: Record<Change["type"], string> = { added: "+", removed: "−", changed: "~" };

/** What a Change is about, in words: an item's name where it has one, else its id. */
export function changeName(change: Change): string {
  const item = (change.after ?? change.before) as { name?: unknown; title?: unknown };
  const name = typeof item.name === "string" ? item.name : typeof item.title === "string" ? item.title : null;
  return name ?? change.id;
}

/** Where clicking a Change takes you: an Element to focus or a View to open; undefined when it has neither. */
export function changeTarget(change: Change): { element: string } | { view: string } | undefined {
  const item = (change.after ?? change.before) as Record<string, unknown>;
  if (change.kind === "element") return { element: change.id };
  if (change.kind === "relationship") return { element: item.from as string };
  if (change.kind === "deployment") return { element: item.service as string };
  if (change.kind === "adr" && Array.isArray(item.elements) && typeof item.elements[0] === "string") return { element: item.elements[0] };
  if (change.kind === "view") return { view: change.id };
  return undefined;
}

/** The Changes list beside the canvas while Comparing; clicking a Change focuses it. */
export function ChangesList({ changes, label, onElement, onView }: { changes: Change[]; label: string; onElement: (id: string) => void; onView: (id: string) => void }) {
  return (
    <aside className="arc-changes" aria-label="Changes">
      <h2>Changes</h2>
      <p className="arc-revision-meta">
        {label}: {changes.length === 0 ? "nothing changed" : `${changes.length} Change${changes.length === 1 ? "" : "s"}`}
      </p>
      <ul>
        {changes.map((c) => {
          const target = changeTarget(c);
          const body = (
            <>
              <span className="arc-change-sign" aria-hidden="true">
                {SIGNS[c.type]}
              </span>
              <span>
                {changeName(c)}
                <br />
                <span className="arc-change-kind">
                  {KIND_NAMES[c.kind]} {c.type}
                  {c.fields.length > 0 ? `: ${c.fields.join(", ")}` : ""}
                </span>
              </span>
            </>
          );
          const className = `arc-change arc-change-${c.type}`;
          return (
            <li key={`${c.kind} ${c.id} ${c.type}`}>
              {target ? (
                <button type="button" className={className} onClick={() => ("element" in target ? onElement(target.element) : onView(target.view))}>
                  {body}
                </button>
              ) : (
                <span className={className}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** One Revision in words: tags, short sha, date and subject. */
export function RevisionSummary({ revision }: { revision: RevisionEntry }) {
  return (
    <span>
      {revision.tags.map((t) => (
        <span key={t} className="arc-tag">
          {t}
        </span>
      ))}
      <code>{revision.sha.slice(0, 7)}</code> {revision.subject}
      <br />
      <span className="arc-revision-meta">
        {shortDate(revision)} · {revision.author} · +{revision.counts.added} −{revision.counts.removed} ~{revision.counts.changed}
        {!revision.bundle && <span className="arc-dropped"> · not kept</span>}
      </span>
    </span>
  );
}

/** The Revision timeline: every Revision, newest first, tags marked; open one with `at`, or Compare from it with `vs`. */
export function RevisionsMenu({ timeline, onAt, onVs }: { timeline: Timeline; onAt: (revision: RevisionEntry) => void; onVs: (revision: RevisionEntry) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);
  if (timeline.revisions.length === 0) return null;
  return (
    <div className="arc-menu-root" ref={root}>
      <button type="button" className="arc-tool arc-menu-button" aria-haspopup="menu" aria-expanded={open} title="Revisions" onClick={() => setOpen(!open)}>
        <Icon name="revisions" />
        <span className="arc-tool-label">Revisions</span>
      </button>
      {open && (
        <div className="arc-menu arc-timeline" role="menu" aria-label="Revisions">
          <ol>
            {timeline.revisions.map((r) => (
              <li key={r.sha}>
                <RevisionSummary revision={r} />
                <span className="arc-revision-actions">
                  <button type="button" disabled={!r.bundle} aria-label={`Open ${pointLabel(r)}`} onClick={() => (setOpen(false), onAt(r))}>
                    Open
                  </button>
                  <button type="button" disabled={!r.bundle} aria-label={`Compare from ${pointLabel(r)}`} onClick={() => (setOpen(false), onVs(r))}>
                    Compare
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
