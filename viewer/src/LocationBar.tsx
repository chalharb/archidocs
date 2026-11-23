import { useEffect, useRef, useState } from "react";
import type { ExportFormat } from "./export.ts";
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
  /** Exports the whole View, or only the picks, as SVG or PNG. */
  onExport: (what: "view" | "picks", format: ExportFormat) => void;
  onSaveAsView: () => void;
}

/** Where am I: breadcrumbs up the scope ladder, chips for open boxes, the Lens and picks, then direction, Recent and Copy link. */
export function LocationBar({ workspace, place, direction, compare, timeline, onCollapse, onDirection, onLens, onPicks, onTime, onExport, onSaveAsView }: LocationBarProps) {
  const crumbs = workspace.crumbs(place.view);
  const name = (id: string) => workspace.byId.get(id)?.name ?? id;
  return (
    <header className="arc-location">
      <span className="arc-history-buttons">
        <button type="button" className="arc-tool arc-step" aria-label="Back" title="Back" onClick={() => window.history.back()}>
          ‹
        </button>
        <button type="button" className="arc-tool arc-step" aria-label="Forward" title="Forward" onClick={() => window.history.forward()}>
          ›
        </button>
      </span>
      <nav aria-label="Breadcrumbs">
        <ol className="arc-crumbs">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${i}:${c.label}`} aria-current={last ? "page" : undefined}>
                {last || c.view === undefined ? <span>{c.label}</span> : <a href={formatPlace(viewPlace(c.view, null, place.lens, place))}>{c.label}</a>}
              </li>
            );
          })}
        </ol>
      </nav>
      <DeploymentLinks workspace={workspace} place={place} />
      {place.open.length > 0 && (
        <section className="arc-chips" role="region" aria-label="Open boxes">
          {place.open.map((id) => (
            <button key={id} type="button" className="arc-chip" aria-label={`Close ${name(id)}`} onClick={() => onCollapse([id])}>
              {name(id)}
              <span className="arc-chip-x" aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="arc-chip arc-chip-all" onClick={() => onCollapse(place.open)}>
            Collapse all
          </button>
        </section>
      )}
      {compare && (
        <section className="arc-chips" role="region" aria-label="Compare">
          <span className="arc-chip arc-chip-lens">
            <span className="arc-lens-kind">Compare</span> {compare}
            <button type="button" className="arc-chip-clear" aria-label="Clear compare" onClick={() => onTime({ vs: null })}>
              <span className="arc-chip-x" aria-hidden="true" />
            </button>
          </span>
        </section>
      )}
      {place.lens && <LensChip workspace={workspace} lens={place.lens} onLens={onLens} />}
      {place.picks.length > 0 && (
        <section className="arc-chips" role="region" aria-label="Picks">
          <button type="button" className="arc-chip arc-chip-picks" aria-label={`Clear ${place.picks.length} picked`} onClick={() => onPicks([])}>
            {place.picks.length} picked
            <span className="arc-chip-x" aria-hidden="true" />
          </button>
        </section>
      )}
      <div className="arc-tools">
        <RevisionsMenu timeline={timeline} onAt={(r) => onTime({ at: timeline.isLatest(r) ? null : pointLabel(r) })} onVs={(r) => onTime({ vs: pointLabel(r) })} />
        <RecentMenu />
        <select className="arc-tool arc-direction" aria-label="Direction" title="Direction" value={direction} onChange={(e) => onDirection(e.target.value as Direction)}>
          {directions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <CopyLink />
        <ExportMenu picks={place.picks.length} onExport={onExport} />
        <button type="button" className="arc-tool arc-primary" onClick={onSaveAsView}>
          Save as View
        </button>
      </div>
    </header>
  );
}

/** Export: the whole View, or the picks once there are any, as SVG or PNG. */
function ExportMenu({ picks, onExport }: { picks: number; onExport: LocationBarProps["onExport"] }) {
  const [open, setOpen] = useState(false);
  const root = useDismiss(open, () => setOpen(false));
  const items: (readonly [string, "view" | "picks", ExportFormat])[] = [
    ["View as SVG", "view", "svg"],
    ["View as PNG", "view", "png"],
    ...(picks > 0
      ? ([
          ["Picks as SVG", "picks", "svg"],
          ["Picks as PNG", "picks", "png"],
        ] as const)
      : []),
  ];
  return (
    <div className="arc-menu-root" ref={root}>
      <button type="button" className="arc-tool arc-menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        Export
      </button>
      {open && (
        <div className="arc-menu" role="menu" aria-label="Export">
          {items.map(([label, what, format]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(what, format);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Closes a menu on Escape or a pointer down outside it; returns the ref for the menu's root. */
function useDismiss(open: boolean, close: () => void) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onEvent = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onEvent);
    window.addEventListener("pointerdown", onEvent);
    return () => {
      window.removeEventListener("keydown", onEvent);
      window.removeEventListener("pointerdown", onEvent);
    };
  }, [open, close]);
  return root;
}

/** One link per Environment to its Deployment View, the current one marked. */
function DeploymentLinks({ workspace, place }: { workspace: Workspace; place: Place }) {
  const links = workspace.deploymentViews();
  if (links.length === 0) return null;
  return (
    <nav className="arc-deployments" aria-label="Deployment Views">
      <span className="arc-deployments-label" aria-hidden="true">
        Deployment:
      </span>
      {links.map((l) =>
        l.view === place.view ? (
          <a key={l.view} href={formatPlace(viewPlace(l.view))} aria-current="page" className="arc-deployment-link arc-current">
            {l.label}
          </a>
        ) : (
          <a key={l.view} href={formatPlace(viewPlace(l.view, null, place.lens))} className="arc-deployment-link">
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
    <section className="arc-chips arc-lens" role="region" aria-label="Lens">
      <span className="arc-chip arc-chip-lens">
        <span className="arc-lens-kind">{"impact" in lens ? "Impact" : "team" in lens ? "Team" : "Connect"}</span>
        {workspace.describeLens(lens)}
        <button type="button" className="arc-chip-clear" aria-label="Clear lens" onClick={() => onLens(null)}>
          <span className="arc-chip-x" aria-hidden="true" />
        </button>
      </span>
      {"impact" in lens && (
        <div className="arc-segmented" role="group" aria-label="Impact direction">
          {(["upstream", "both", "downstream"] as const).map((way) => (
            <button key={way} type="button" aria-pressed={lens.direction === way} onClick={() => onLens({ ...lens, direction: way })}>
              {way === "both" ? "Both" : way === "upstream" ? "Upstream" : "Downstream"}
            </button>
          ))}
        </div>
      )}
      {"path" in lens && (
        <div className="arc-segmented" role="group" aria-label="Paths">
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
    <div className="arc-menu-root" ref={root}>
      <button type="button" className="arc-tool arc-menu-button" aria-haspopup="menu" aria-expanded={items !== null} onClick={() => setItems(items ? null : readRecent())}>
        Recent
      </button>
      {items && (
        <div className="arc-menu" role="menu" aria-label="Recent">
          {items.length === 0 && <p className="arc-menu-empty">Nothing yet</p>}
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
      className="arc-tool"
      aria-label="Copy link"
      onClick={() => {
        void navigator.clipboard.writeText(window.location.href).then(() => setCopied(true));
      }}
    >
      {copied ? "✓ Copied" : "⧉ Link"}
    </button>
  );
}
