import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bundle } from "../../src/schema/bundle.ts";
import { unionBundle } from "../../src/core/compare.ts";
import { diff, type Change } from "../../src/core/diff.ts";
import { compareView, type ResolvedStep } from "../../src/core/views/index.ts";
import { AdrReader } from "./AdrReader.tsx";
import { Canvas } from "./Canvas.tsx";
import { DynamicScreen } from "./DynamicScreen.tsx";
import { ElementPanel } from "./ElementPanel.tsx";
import { fileName, picture, save, type ExportFormat } from "./export.ts";
import { Find } from "./Find.tsx";
import { go, usePlace } from "./history.ts";
import { useLayout, type LaidOut } from "./layout.ts";
import { LocationBar } from "./LocationBar.tsx";
import { HOME, formatPlace, viewPlace, type Direction, type Lens, type Place } from "./place.ts";
import { Rail } from "./Rail.tsx";
import { AtBanner, ChangesList, Unavailable, useTimes } from "./History.tsx";
import { loadTimeline, pointLabel, type Revision, type Timeline } from "./revisions.ts";
import { remember } from "./recent.ts";
import { SaveAsView } from "./SaveAsView.tsx";
import { Workspace } from "./workspace.ts";

/**
 * Loads the latest Bundle and the Revision index next to index.html;
 * relative URLs, so the site works under any base path.
 */
function useSite(): { latest?: Bundle; timeline?: Timeline; name?: string; error?: string } {
  const [state, setState] = useState<{ latest?: Bundle; timeline?: Timeline; name?: string; error?: string }>({});
  useEffect(() => {
    // site.json names the Workspace for exports; a site without it still opens.
    const name = fetch("./site.json")
      .then((r): Promise<{ workspace?: string }> | { workspace?: string } => (r.ok ? r.json() : {}))
      .then((site) => site.workspace)
      .catch(() => undefined);
    const latest = fetch("./workspace.bundle.json").then((r) => (r.ok ? (r.json() as Promise<Bundle>) : Promise.reject(new Error(`workspace.bundle.json: HTTP ${r.status}`))));
    Promise.all([latest, loadTimeline(), name])
      .then(([bundle, timeline, workspaceName]) => {
        openPreview(timeline);
        setState({ latest: bundle, timeline, name: workspaceName });
      })
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }));
  }, []);
  return state;
}

/**
 * A PR preview site opened at its root (no View in the URL) starts with
 * Compare "base → PR" on the C2 Landscape; a link to a place opens as is.
 */
function openPreview(timeline: Timeline) {
  const base = timeline.previewBase();
  if (base && !/^#\/view\//.test(window.location.hash)) go({ ...HOME, vs: pointLabel(base) }, { replace: true });
}

export function App() {
  const { latest, timeline, name, error } = useSite();
  if (error) return <Message title="Couldn't load the Workspace">{error}</Message>;
  if (!latest || !timeline) return <Message title="Loading the Workspace…" />;
  return <AtTime latest={latest} timeline={timeline} name={name} />;
}

/** What Compare shows: both sides, their Changes, and how the chip and list name them. */
export interface Comparison {
  before: Bundle;
  after: Bundle;
  changes: Change[];
  /** "v1 → latest" */
  label: string;
}

/** Loads the Bundles the URL's `at` and `vs` name, then shows the screen at that time, or why it can't. */
function AtTime({ latest, timeline, name }: { latest: Bundle; timeline: Timeline; name: string | undefined }) {
  const place = usePlace();
  const { state, loading } = useTimes(latest, timeline, place.at, place.vs);
  const times = state?.kind === "ready" ? state.times : undefined;
  const current = times?.current;
  const plain = useMemo(() => (current ? new Workspace(current, name) : undefined), [current, name]);
  const comparison = useMemo<Comparison | undefined>(() => {
    if (!times?.before) return undefined;
    const { before, current: after, vs, at: atRevision } = times;
    return { before, after, changes: diff(before, after), label: timeline.compareLabel(vs!, atRevision) };
  }, [times, timeline]);
  const workspace = useMemo(() => (comparison ? new Workspace(unionBundle(comparison.before, comparison.after), name) : plain), [comparison, plain, name]);
  if (state?.kind === "problem") return <Unavailable problem={state.problem} place={place} />;
  if (!workspace || !plain) return <Message title="Loading the Revision…" />;
  return <Screen workspace={workspace} plain={plain} comparison={comparison} timeline={timeline} at={times?.at} loading={loading} />;
}

interface ScreenProps {
  /** The Workspace on screen: at `at` (or the latest), or while Comparing the union of both sides. */
  workspace: Workspace;
  /** The Workspace at `at` (or the latest) alone, for screens Compare doesn't mark. */
  plain: Workspace;
  comparison: Comparison | undefined;
  timeline: Timeline;
  at: Revision | undefined;
  /** New `at` or `vs` Bundles are loading; the screen shows the last ones meanwhile. */
  loading: boolean;
}

function Screen({ workspace, plain, comparison, timeline, at, loading }: ScreenProps) {
  const place = usePlace();
  const openKey = place.open.join(",");
  const view = useMemo(
    () => (comparison ? compareView(comparison.before, comparison.after, place.view, { expand: place.open }) : workspace.resolve(place.view, place.open, "none")),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openKey stands for place.open, so the View is only resolved again when it changes.
    [workspace, comparison, place.view, openKey],
  );
  const dynamic = useMemo(() => plain.dynamic(place.view), [plain, place.view]);
  /** The direction on screen: the one the viewer turned it to, else the View's own. */
  const direction = place.direction ?? view?.direction;
  const { laidOut, error } = useLayout(view, direction);
  const [settled, setSettled] = useState<LaidOut>();
  // Ready once the Layout of exactly this screen is drawn and still; tests and screenshots wait for it.
  const ready = !loading && laidOut !== undefined && settled === laidOut && laidOut.view === view && laidOut.layout.direction === direction;
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
    (node: string) => {
      // A Deployment or a Target's System box opens the View of the Element it draws.
      const id = view?.nodes.find((n) => n.id === node)?.element ?? node;
      const target = workspace.ownView(id);
      if (target !== undefined && target !== place.view) go(viewPlace(target, null, place.lens, place));
    },
    [place, workspace, view],
  );

  /** Focuses an Element, closing any ADR: in the current View when opening its boxes shows it there, else in its own View. */
  const focus = useCallback(
    (id: string) => {
      const open = opening(workspace, place, id);
      if (open) return go({ ...place, open, selected: id, adr: null }, { replace: open.length === place.open.length });
      const element = workspace.byId.get(id);
      const home = element?.kind === "component" ? workspace.ownView(element.parent!) : element?.kind === "person" ? "c1" : workspace.ownView(id);
      go(viewPlace(home ?? "c2", id, place.lens, place));
    },
    [place, workspace],
  );

  const setDirection = useCallback((d: Direction) => go({ ...place, direction: d === view?.direction ? null : d }), [place, view]);

  /** Opens a View from the rail: a Saved View with its own Lens, any other keeping the current Lens. */
  const pickView = useCallback((v: string) => go(viewPlace(v, null, workspace.ownLens(v) ?? place.lens, place)), [workspace, place]);

  const [saving, setSaving] = useState(false);
  const exportPicture = useCallback(
    (what: "view" | "picks", format: ExportFormat) => {
      const shown = lensed ?? view;
      if (!shown) return;
      const drawn = what === "picks" ? workspace.picked(shown, place.picks) : shown;
      void picture(workspace, drawn, direction, format).then((blob) => save(blob, fileName(place.view, format, what === "picks")));
    },
    [workspace, lensed, view, place.picks, place.view, direction],
  );

  /** Opens a Generated View from a Step: the boxes that show both ends of its Relationship open, its consumer (or what shows it) selected. */
  const openStepView = useCallback(
    (target: string, step: ResolvedStep) => {
      const ends = [step.relationship.from, step.relationship.to];
      let open: string[] = [];
      for (const id of ends) open = opening(workspace, { ...viewPlace(target), open }, id) ?? open;
      const shown = new Set(workspace.resolve(target, open, "none")?.nodes.map((n) => n.id) ?? []);
      const selected = [ends[0]!, ...workspace.ancestors(ends[0]!).reverse()].find((id) => shown.has(id)) ?? null;
      go({ ...viewPlace(target, null, null, place), open, selected });
    },
    [workspace, place],
  );

  const rail = (
    <Rail
      workspace={workspace}
      view={place.view}
      selected={place.selected}
      home={formatPlace({ ...HOME, at: place.at, vs: place.vs })}
      onPickElement={focus}
      onPickView={pickView}
      onPickTeam={(team) => setLens({ team })}
      finding={finding}
      onFind={() => setFinding(true)}
      onOpenPanel={() => setFinding(false)}
    />
  );

  // The panel shows the selected node's Element: a Deployment's is its Service.
  const selectedElement = place.selected === null ? undefined : (view?.nodes.find((n) => n.id === place.selected)?.element ?? place.selected);
  const panelFor = useOpensAfterDoubleClick(selectedElement !== undefined && workspace.byId.has(selectedElement) ? selectedElement : undefined);

  if (dynamic) {
    return (
      <div className="arc-app">
        {rail}
        {finding && <Find workspace={workspace} onClose={() => setFinding(false)} onPick={(id) => {
              setFinding(false);
              focus(id);
            }}
          />}
        <main className="arc-main arc-main-dynamic">
          <DynamicScreen workspace={plain} view={dynamic} place={place} keys={!finding} onOpenStepView={openStepView} onOpenView={(v) => go(viewPlace(v, null, null, place))} />
        </main>
      </div>
    );
  }


  if (!view) {
    return (
      <Message title={`No View ${place.view}`}>
        <a href={formatPlace({ ...HOME, at: place.at, vs: place.vs })}>Open the C2 Landscape</a>
      </Message>
    );
  }

  return (
    <div className="arc-app">
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
      <main className={at ? "arc-main arc-has-time" : "arc-main"}>
        <LocationBar
          workspace={workspace}
          place={place}
          direction={place.direction ?? view.direction}
          compare={comparison?.label}
          timeline={timeline}
          onCollapse={collapse}
          onDirection={setDirection}
          onLens={setLens}
          onPicks={(picks) => go({ ...place, picks }, { replace: true })}
          onExport={exportPicture}
          onSaveAsView={() => setSaving(true)}
          onTime={(time) => go({ ...place, ...time })}
        />
        {saving && (
          <SaveAsView
            workspace={workspace}
            screen={{ view: place.view, open: place.open, lens: place.lens, picks: place.picks, direction: place.direction }}
            title={title ?? view.title}
            onClose={() => setSaving(false)}
          />
        )}
        {at && <AtBanner revision={at} place={place} />}
        {connectFrom !== null && (
          <p className="arc-banner" role="status">
            Pick the node to connect {workspace.name(connectFrom)} to: click it, or press / to find it. Escape cancels.
          </p>
        )}
        <div className="arc-stage">
        {comparison && <ChangesList changes={comparison.changes} label={comparison.label} onElement={focus} onView={(v) => go(viewPlace(v, null, place.lens, place))} />}
        <div className="arc-canvas" data-canvas data-state={ready ? "ready" : "busy"}>
          {error && <p className="arc-error">Layout failed: {error}</p>}
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
          {panelFor !== undefined && (
            <ElementPanel
              workspace={workspace}
              id={panelFor}
              timeline={timeline}
              comparison={comparison}
              onLens={setLens}
              onConnect={setConnectFrom}
              onFocus={focus}
              onOpenView={openView}
              onOpenAdr={openAdr}
              onTime={(time) => go({ ...place, ...time })}
              onDeployed={(target, nodes) => go({ ...viewPlace(target, null, null, place), picks: nodes })}
              onClose={() => select(null)}
            />
          )}
          {place.adr !== null && (
            <AdrReader
              workspace={workspace}
              id={place.adr}
              beside={panelFor !== undefined}
              onClose={() => openAdr(null)}
              onOpenAdr={openAdr}
              onFocus={focus}
              onOpenView={(v) => go(viewPlace(v, null, place.lens, place))}
            />
          )}
        </div>
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
    const nodes = workspace.resolve(place.view, open, "none")?.nodes ?? [];
    if (nodes.some((n) => n.id === id)) return open;
    if (a !== id && !open.includes(a) && nodes.some((n) => n.id === a)) open.push(a);
  }
  return undefined;
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="arc-message">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}

/** How long a closed Element panel waits before it opens, so it never lands under the second click of a double-click. */
const PANEL_OPEN_DELAY = 250;

/**
 * The Element to show in the panel. A closed panel opens a moment after a selection, because the drawing
 * now runs under where it opens: shown at once, it would catch a double-click's second click meant for the box.
 * An open panel follows a new selection immediately, and closes immediately; a selection in the URL shows at once.
 */
function useOpensAfterDoubleClick(id: string | undefined): string | undefined {
  // `ready` is the Element whose panel may show; `previous` is the last selection, to tell a first selection from a change.
  const [ready, setReady] = useState(id);
  const [previous, setPrevious] = useState(id);
  if (id !== previous) {
    setPrevious(id);
    // Closing, or moving from one Element to another while the panel is open, takes effect at once.
    if (id === undefined || previous !== undefined) setReady(id);
  }
  useEffect(() => {
    if (id === undefined || ready === id) return;
    const timer = window.setTimeout(() => setReady(id), PANEL_OPEN_DELAY);
    return () => window.clearTimeout(timer);
  }, [id, ready]);
  return ready === id ? id : undefined;
}
