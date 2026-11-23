import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bundle } from "../../src/schema/bundle.ts";
import { Canvas } from "./Canvas.tsx";
import { go, usePlace } from "./history.ts";
import { useLayout, type LaidOut } from "./layout.ts";
import { LocationBar } from "./LocationBar.tsx";
import { defaultDirection, HOME, formatPlace, viewPlace, type Direction, type Place } from "./place.ts";
import { Rail } from "./Rail.tsx";
import { remember } from "./recent.ts";
import { Workspace } from "./workspace.ts";

/** Loads the latest Bundle next to index.html; a relative URL, so the site works under any base path. */
function useWorkspace(): { workspace?: Workspace; error?: string } {
  const [state, setState] = useState<{ workspace?: Workspace; error?: string }>({});
  useEffect(() => {
    fetch("./workspace.bundle.json")
      .then((r) => (r.ok ? (r.json() as Promise<Bundle>) : Promise.reject(new Error(`workspace.bundle.json: HTTP ${r.status}`))))
      .then((bundle) => setState({ workspace: new Workspace(bundle) }))
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }));
  }, []);
  return state;
}

export function App() {
  const { workspace, error } = useWorkspace();
  if (error) return <Message title="Couldn't load the Workspace">{error}</Message>;
  if (!workspace) return <Message title="Loading the Workspace…" />;
  return <Screen workspace={workspace} />;
}

function Screen({ workspace }: { workspace: Workspace }) {
  const place = usePlace();
  const openKey = place.open.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openKey stands for place.open, so the View is only resolved again when it changes.
  const view = useMemo(() => workspace.resolve(place.view, place.open), [workspace, place.view, openKey]);
  const direction = place.direction ?? defaultDirection(place.view);
  const { laidOut, error } = useLayout(view, direction);
  const [settled, setSettled] = useState<LaidOut>();
  // Ready once the Layout of exactly this screen is drawn and still; tests and screenshots wait for it.
  const ready = laidOut !== undefined && settled === laidOut && laidOut.view === view && laidOut.layout.direction === direction;
  const title = workspace.title(place.view);

  useEffect(() => {
    document.title = title ? `${title} · Archidocs` : "Archidocs";
    if (title) remember(place, title);
    // Recent follows the URL, which `place` is read from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatPlace(place), title]);

  const select = useCallback((id: string | null) => go({ ...place, selected: id }, { replace: true }), [place]);

  const toggle = useCallback(
    (id: string, open: boolean) => {
      if (open) return go({ ...place, open: [...place.open, id] });
      const inside = (other: string) => other === id || workspace.ancestors(other).includes(id);
      go({ ...place, open: place.open.filter((o) => !inside(o)), selected: place.selected !== null && workspace.ancestors(place.selected).includes(id) ? null : place.selected });
    },
    [place, workspace],
  );

  const collapse = useCallback(
    (ids: string[]) => {
      const closing = (other: string) => ids.some((id) => other === id || workspace.ancestors(other).includes(id));
      const selectedHidden = place.selected !== null && workspace.ancestors(place.selected).some((a) => ids.includes(a));
      go({ ...place, open: place.open.filter((o) => !closing(o)), selected: selectedHidden ? null : place.selected });
    },
    [place, workspace],
  );

  const openView = useCallback(
    (id: string) => {
      const target = workspace.ownView(id);
      if (target !== undefined && target !== place.view) go(viewPlace(target));
    },
    [place.view, workspace],
  );

  /** Focuses an Element: in the current View when opening its boxes shows it there, else in its own View. */
  const focus = useCallback(
    (id: string) => {
      const open = opening(workspace, place, id);
      if (open) return go({ ...place, open, selected: id }, { replace: open.length === place.open.length });
      const element = workspace.byId.get(id);
      const home = element?.kind === "component" ? workspace.ownView(element.parent!) : element?.kind === "person" ? "c1" : workspace.ownView(id);
      go(viewPlace(home ?? "c2", id));
    },
    [place, workspace],
  );

  const setDirection = useCallback((d: Direction) => go({ ...place, direction: d === defaultDirection(place.view) ? null : d }), [place]);

  if (!view) {
    return (
      <Message title={`No View ${place.view}`}>
        <a href={formatPlace(HOME)}>Open the C2 Landscape</a>
      </Message>
    );
  }

  return (
    <div className="ad-app">
      <Rail workspace={workspace} view={place.view} selected={place.selected} onPickElement={focus} onPickView={(v) => go(viewPlace(v))} />
      <main className="ad-main">
        <LocationBar workspace={workspace} place={place} direction={direction} onCollapse={collapse} onDirection={setDirection} />
        <div className="ad-canvas" data-canvas data-state={ready ? "ready" : "busy"}>
          {error && <p className="ad-error">Layout failed: {error}</p>}
          {laidOut && (
            <Canvas
              workspace={workspace}
              laidOut={laidOut}
              selected={place.selected}
              open={place.open}
              fitKey={`${place.view}|${direction}`}
              onSelect={select}
              onToggle={toggle}
              onOpenView={openView}
              onSettled={setSettled}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * The open boxes that show `id` in the current View: those already open plus
 * each ancestor the View shows collapsed on the way down; undefined when the
 * View can't show it.
 */
function opening(workspace: Workspace, place: Place, id: string): string[] | undefined {
  const open = [...place.open];
  for (const a of [...workspace.ancestors(id), id]) {
    const nodes = workspace.resolve(place.view, open)?.nodes ?? [];
    if (nodes.some((n) => n.id === id)) return open;
    if (a !== id && !open.includes(a) && nodes.some((n) => n.id === a)) open.push(a);
  }
  return undefined;
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ad-message">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
