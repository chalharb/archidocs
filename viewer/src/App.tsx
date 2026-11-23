import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bundle } from "../../src/schema/bundle.ts";
import type { ResolvedStep } from "../../src/core/dynamic-views.ts";
import { AdrReader } from "./AdrReader.tsx";
import { Canvas } from "./Canvas.tsx";
import { DynamicScreen } from "./DynamicScreen.tsx";
import { ElementPanel } from "./ElementPanel.tsx";
import { Find } from "./Find.tsx";
import { go, usePlace } from "./history.ts";
import { useLayout, type LaidOut } from "./layout.ts";
import { LocationBar } from "./LocationBar.tsx";
import { defaultDirection, HOME, formatPlace, viewPlace, type Direction, type Lens, type Place } from "./place.ts";
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
  const dynamic = useMemo(() => workspace.dynamic(place.view), [workspace, place.view]);
  const direction = place.direction ?? defaultDirection(place.view);
  const { laidOut, error } = useLayout(view, direction);
  const [settled, setSettled] = useState<LaidOut>();
  // Ready once the Layout of exactly this screen is drawn and still; tests and screenshots wait for it.
  const ready = laidOut !== undefined && settled === laidOut && laidOut.view === view && laidOut.layout.direction === direction;
  const title = workspace.title(place.view);
  const lensKey = place.lens ? JSON.stringify(place.lens) : "";
  // The Lens is drawn over the Layout of the plain View, so turning it on never moves a node.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openKey and lensKey stand for place.open and place.lens.
  const lensed = useMemo(() => (place.lens ? workspace.resolve(place.view, place.open, place.lens) : undefined), [workspace, place.view, openKey, lensKey]);
  const [finding, setFinding] = useState(false);
  /** The start of a Connect to… waiting for its end node. */
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  useEffect(() => {
    document.title = title ? `${title} · Archidocs` : "Archidocs";
    if (title) remember(place, title);
    // Recent follows the URL, which `place` is read from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatPlace(place), title]);

  /** Turns a Lens on, off or to another; a path Lens picks the nodes on its paths. */
  const setLens = useCallback(
    (lens: Lens | null) => {
      const picks = lens && "path" in lens ? (workspace.resolve(place.view, place.open, lens)?.nodes.filter((n) => n.mark?.hit).map((n) => n.id) ?? []) : place.picks;
      go({ ...place, lens, picks });
    },
    [place, workspace],
  );

  const connect = useCallback(
    (to: string) => {
      const from = connectFrom!;
      setConnectFrom(null);
      if (to !== from) setLens({ path: { from, to, paths: "shortest" } });
    },
    [connectFrom, setLens],
  );

  const select = useCallback(
    (id: string | null) => {
      if (connectFrom !== null && id !== null) return connect(id);
      go({ ...place, selected: id }, { replace: true });
    },
    [place, connectFrom, connect],
  );

  const pick = useCallback((id: string) => go({ ...place, picks: place.picks.includes(id) ? place.picks.filter((p) => p !== id) : [...place.picks, id] }, { replace: true }), [place]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setFinding(true);
      } else if (e.key === "Escape" && !finding) {
        if (connectFrom !== null) setConnectFrom(null);
        else if (place.adr !== null) go({ ...place, adr: null }, { replace: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finding, connectFrom, place]);

  /** Opens an ADR in the reader, or closes it with null; like selection, it replaces the history entry. */
  const openAdr = useCallback((adr: string | null) => go({ ...place, adr }, { replace: true }), [place]);

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
      if (target !== undefined && target !== place.view) go(viewPlace(target, null, place.lens));
    },
    [place.view, place.lens, workspace],
  );

  /** Focuses an Element, closing any ADR: in the current View when opening its boxes shows it there, else in its own View. */
  const focus = useCallback(
    (id: string) => {
      const open = opening(workspace, place, id);
      if (open) return go({ ...place, open, selected: id, adr: null }, { replace: open.length === place.open.length });
      const element = workspace.byId.get(id);
      const home = element?.kind === "component" ? workspace.ownView(element.parent!) : element?.kind === "person" ? "c1" : workspace.ownView(id);
      go(viewPlace(home ?? "c2", id, place.lens));
    },
    [place, workspace],
  );

  const setDirection = useCallback((d: Direction) => go({ ...place, direction: d === defaultDirection(place.view) ? null : d }), [place]);

  /** Opens a Generated View from a Step: the boxes that show both ends of its Relationship open, its consumer (or what shows it) selected. */
  const openStepView = useCallback(
    (target: string, step: ResolvedStep) => {
      const ends = [step.relationship.from, step.relationship.to];
      let open: string[] = [];
      for (const id of ends) open = opening(workspace, { ...viewPlace(target), open }, id) ?? open;
      const shown = new Set(workspace.resolve(target, open)?.nodes.map((n) => n.id) ?? []);
      const selected = [ends[0]!, ...workspace.ancestors(ends[0]!).reverse()].find((id) => shown.has(id)) ?? null;
      go({ ...viewPlace(target), open, selected });
    },
    [workspace],
  );

  const rail = (
    <Rail
      workspace={workspace}
      view={place.view}
      selected={place.selected}
      onPickElement={focus}
      onPickView={(v) => go(viewPlace(v, null, place.lens))}
      onPickTeam={(team) => setLens({ team })}
      onFind={() => setFinding(true)}
    />
  );

  if (dynamic) {
    return (
      <div className="ad-app">
        {rail}
        {finding && <Find workspace={workspace} onClose={() => setFinding(false)} onPick={(id) => {
              setFinding(false);
              focus(id);
            }}
          />}
        <main className="ad-main ad-main-dynamic">
          <DynamicScreen workspace={workspace} view={dynamic} place={place} keys={!finding} onOpenStepView={openStepView} onOpenView={(v) => go(viewPlace(v))} />
        </main>
      </div>
    );
  }

  if (!view) {
    return (
      <Message title={`No View ${place.view}`}>
        <a href={formatPlace(HOME)}>Open the C2 Landscape</a>
      </Message>
    );
  }

  return (
    <div className="ad-app">
      {rail}
      {finding && (
        <Find
          workspace={workspace}
          prompt={connectFrom !== null ? `Pick the node to connect ${workspace.name(connectFrom)} to` : undefined}
          onClose={() => setFinding(false)}
          onPick={(id) => {
            setFinding(false);
            if (connectFrom !== null) connect(id);
            else focus(id);
          }}
        />
      )}
      <main className="ad-main">
        <LocationBar workspace={workspace} place={place} direction={direction} onCollapse={collapse} onDirection={setDirection} onLens={setLens} onPicks={(picks) => go({ ...place, picks }, { replace: true })} />
        {connectFrom !== null && (
          <p className="ad-banner" role="status">
            Pick the node to connect {workspace.name(connectFrom)} to: click it, or press / to find it. Escape cancels.
          </p>
        )}
        <div className="ad-canvas" data-canvas data-state={ready ? "ready" : "busy"}>
          {error && <p className="ad-error">Layout failed: {error}</p>}
          {laidOut && (
            <Canvas
              workspace={workspace}
              laidOut={laidOut}
              selected={place.selected}
              open={place.open}
              fitKey={`${place.view}|${direction}`}
              lensed={lensed}
              picks={place.picks}
              ring={place.lens !== null && "team" in place.lens}
              onSelect={select}
              onPick={pick}
              onToggle={toggle}
              onOpenView={openView}
              onSettled={setSettled}
            />
          )}
          {place.selected !== null && workspace.byId.has(place.selected) && (
            <ElementPanel workspace={workspace} id={place.selected} onLens={setLens} onConnect={setConnectFrom} onFocus={focus} onOpenView={openView} onOpenAdr={openAdr} />
          )}
          {place.adr !== null && (
            <AdrReader
              workspace={workspace}
              id={place.adr}
              beside={place.selected !== null && workspace.byId.has(place.selected)}
              onClose={() => openAdr(null)}
              onOpenAdr={openAdr}
              onFocus={focus}
              onOpenView={(v) => go(viewPlace(v, null, place.lens))}
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
