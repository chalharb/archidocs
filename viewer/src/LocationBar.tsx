import { useEffect, useRef, useState } from "react";
import { directions, formatPlace, type Direction, type Place } from "./place.ts";
import { readRecent, type RecentPlace } from "./recent.ts";
import type { Workspace } from "./workspace.ts";

export interface LocationBarProps {
  workspace: Workspace;
  place: Place;
  direction: Direction;
  onCollapse: (ids: string[]) => void;
  onDirection: (direction: Direction) => void;
}

/** Where am I: breadcrumbs up the scope ladder, chips for open boxes, then direction, Recent and Copy link. */
export function LocationBar({ workspace, place, direction, onCollapse, onDirection }: LocationBarProps) {
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
                {last ? <span>{c.label}</span> : <a href={formatPlace({ view: c.view, open: [], selected: null, direction: null })}>{c.label}</a>}
              </li>
            );
          })}
        </ol>
      </nav>
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
      <div className="ad-tools">
        <div className="ad-segmented ad-direction" role="group" aria-label="Direction">
          {directions.map((d) => (
            <button key={d} type="button" aria-pressed={d === direction} onClick={() => onDirection(d)}>
              {d}
            </button>
          ))}
        </div>
        <RecentMenu />
        <CopyLink />
      </div>
    </header>
  );
}

function RecentMenu() {
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

function CopyLink() {
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
