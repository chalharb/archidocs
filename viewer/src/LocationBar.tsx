import { useEffect, useRef, useState } from "react";
import { directions, formatPlace, viewPlace, type Direction, type Lens, type Place } from "./place.ts";
import { readRecent, type RecentPlace } from "./recent.ts";
import type { Workspace } from "./workspace.ts";
import { RevisionsMenu } from "./History.tsx";
import { pointLabel, type Timeline } from "./revisions.ts";

export interface LocationBarProps {
  workspace: Workspace;
  place: Place;
  direction: Direction;
  onCollapse: (ids: string[]) => void;
  onDirection: (direction: Direction) => void;
  onLens: (lens: Lens | null) => void;
  onPicks: (picks: string[]) => void;
  /** While Comparing, what with what: "v1 → latest". */
  compare: string | undefined;
  timeline: Timeline;
  /** Moves to another `at` or `vs`; null clears it. */
  onTime: (time: Partial<Pick<Place, "at" | "vs">>) => void;
}

/** Where am I: breadcrumbs up the scope ladder, chips for open boxes, the Lens and picks, then direction, Recent and Copy link. */
export function LocationBar({ workspace, place, direction, compare, timeline, onCollapse, onDirection, onLens, onPicks, onTime }: LocationBarProps) {
  const crumbs = workspace.crumbs(place.view);
  const name = (id: string) => workspace.byId.get(id)?.name ?? id;
  return (
    <header className="ad-location">
      <nav aria-label="Breadcrumbs">
        <ol className="ad-crumbs">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={c.view} aria-current={last ? "page" : undefined}>
                {last ? <span>{c.label}</span> : <a href={formatPlace(viewPlace(c.view, null, place.lens, place))}>{c.label}</a>}
              </li>
            );
          })}
        </ol>
      </nav>
      <DeploymentLinks workspace={workspace} place={place} />
      {place.open.length > 0 && (
        <section className="ad-chips" role="region" aria-label="Open boxes">
          {place.open.map((id) => (
            <button key={id} type="button" className="ad-chip" aria-label={`Close ${name(id)}`} onClick={() => onCollapse([id])}>
              {name(id)}
              <span className="ad-chip-x" aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="ad-chip ad-chip-all" onClick={() => onCollapse(place.open)}>
            Collapse all
          </button>
        </section>
      )}
      {compare && (
        <section className="ad-chips" role="region" aria-label="Compare">
          <span className="ad-chip ad-chip-lens">
            <span className="ad-lens-kind">Compare</span> {compare}
            <button type="button" className="ad-chip-clear" aria-label="Clear compare" onClick={() => onTime({ vs: null })}>
              <span className="ad-chip-x" aria-hidden="true" />
            </button>
          </span>
        </section>
      )}
      {place.lens && <LensChip workspace={workspace} lens={place.lens} onLens={onLens} />}
      {place.picks.length > 0 && (
        <section className="ad-chips" role="region" aria-label="Picks">
          <button type="button" className="ad-chip ad-chip-picks" aria-label={`Clear ${place.picks.length} picked`} onClick={() => onPicks([])}>
            {place.picks.length} picked
            <span className="ad-chip-x" aria-hidden="true" />
          </button>
        </section>
      )}
      <div className="ad-tools">
        <div className="ad-segmented ad-direction" role="group" aria-label="Direction">
          {directions.map((d) => (
            <button key={d} type="button" aria-pressed={d === direction} onClick={() => onDirection(d)}>
              {d}
            </button>
          ))}
        </div>
        <RevisionsMenu timeline={timeline} onAt={(r) => onTime({ at: timeline.isLatest(r) ? null : pointLabel(r) })} onVs={(r) => onTime({ vs: pointLabel(r) })} />
        <RecentMenu />
        <CopyLink />
      </div>
    </header>
  );
}

/** One link per Environment to its Deployment View, the current one marked. */
function DeploymentLinks({ workspace, place }: { workspace: Workspace; place: Place }) {
  const links = workspace.deploymentViews();
  if (links.length === 0) return null;
  return (
    <nav className="ad-deployments" aria-label="Deployment Views">
      <span className="ad-deployments-label" aria-hidden="true">
        Deployment
      </span>
      {links.map((l) =>
        l.view === place.view ? (
          <a key={l.view} href={formatPlace(viewPlace(l.view))} aria-current="page" className="ad-deployment-link ad-current">
            {l.label}
          </a>
        ) : (
          <a key={l.view} href={formatPlace(viewPlace(l.view, null, place.lens))} className="ad-deployment-link">
            {l.label}
          </a>
        ),
      )}
    </nav>
  );
}

/** The active Lens in words, with its own switches (impact direction, or Shortest / All ≤ 4 hops) and ✕ to clear it. */
function LensChip({ workspace, lens, onLens }: { workspace: Workspace; lens: Lens; onLens: (lens: Lens | null) => void }) {
  return (
    <section className="ad-chips ad-lens" role="region" aria-label="Lens">
      <span className="ad-chip ad-chip-lens">
        <span className="ad-lens-kind">{"impact" in lens ? "Impact" : "team" in lens ? "Team" : "Connect"}</span>
        {workspace.describeLens(lens)}
        <button type="button" className="ad-chip-clear" aria-label="Clear lens" onClick={() => onLens(null)}>
          <span className="ad-chip-x" aria-hidden="true" />
        </button>
      </span>
      {"impact" in lens && (
        <div className="ad-segmented" role="group" aria-label="Impact direction">
          {(["upstream", "both", "downstream"] as const).map((way) => (
            <button key={way} type="button" aria-pressed={lens.direction === way} onClick={() => onLens({ ...lens, direction: way })}>
              {way === "both" ? "Both" : way === "upstream" ? "Upstream" : "Downstream"}
            </button>
          ))}
        </div>
      )}
      {"path" in lens && (
        <div className="ad-segmented" role="group" aria-label="Paths">
          {(["shortest", 4] as const).map((paths) => (
            <button key={paths} type="button" aria-pressed={(lens.path.paths ?? "shortest") === paths} onClick={() => onLens({ path: { ...lens.path, paths } })}>
              {paths === "shortest" ? "Shortest" : "All ≤ 4 hops"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecentMenu() {
  const [items, setItems] = useState<RecentPlace[] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!items) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setItems(null);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [items]);
  return (
    <div className="ad-menu-root" ref={root}>
      <button type="button" className="ad-tool" aria-haspopup="menu" aria-expanded={items !== null} onClick={() => setItems(items ? null : readRecent())}>
        Recent
      </button>
      {items && (
        <div className="ad-menu" role="menu" aria-label="Recent">
          {items.length === 0 && <p className="ad-menu-empty">Nothing yet</p>}
          {items.map((r) => (
            <a key={r.key} role="menuitem" href={r.hash} onClick={() => setItems(null)}>
              {r.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="ad-tool ad-primary"
      aria-label="Copy link"
      onClick={() => {
        void navigator.clipboard.writeText(window.location.href).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
