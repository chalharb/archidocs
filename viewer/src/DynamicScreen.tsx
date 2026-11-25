import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { dynamicViewsUsing, stepViews, type ResolvedDynamicView, type ResolvedStep } from "../../src/core/views/index.ts";
import { layoutSequence, type MessageStyle } from "../../src/render/sequence.ts";
import { go } from "./history.ts";
import { CopyLink, RecentMenu } from "./LocationBar.tsx";
import type { Place } from "./place.ts";
import { SequenceChart } from "./SequenceChart.tsx";
import { StepGraph } from "./StepGraph.tsx";
import { useReducedMotion } from "./motion.ts";
import type { Workspace } from "./workspace.ts";
import { Icon } from "./Icon.tsx";

/** Playback advances one Step this often. */
export const PLAY_MS = 1400;

export interface DynamicScreenProps {
  workspace: Workspace;
  view: ResolvedDynamicView;
  place: Place;
  /** Keys are off while another dialog, such as Find, has them. */
  keys: boolean;
  /** Opens a Generated View showing both ends of a Step's Relationship. */
  onOpenStepView: (view: string, step: ResolvedStep) => void;
  onOpenView: (view: string) => void;
}

const STYLE_OF = (s: ResolvedStep): MessageStyle => (s.kind === "return" ? "return" : s.interaction);
const STYLE_NAME: Record<MessageStyle, string> = { sync: "Sync call", async: "Async", return: "Return" };

/**
 * A Dynamic View as a walkthrough: the play transport and numbered outline on
 * the left, the sequence chart (or the numbered-Step graph) in the middle, and
 * the selected Step's detail on the right. The selected Step is shared by all
 * of them, and lives in the URL.
 */
export function DynamicScreen({ workspace, view, place, keys, onOpenStepView, onOpenView }: DynamicScreenProps) {
  const steps = view.steps;
  const index = steps.findIndex((s) => s.n === place.step);
  const step = index < 0 ? undefined : steps[index];
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useReducedMotion();
  const name = useCallback((id: string) => workspace.name(id), [workspace]);
  const layout = useMemo(() => layoutSequence(view, { name, brokers: place.brokers }), [view, name, place.brokers]);
  const fitKey = `${view.id}|${place.brokers ? "brokers" : "direct"}|${place.graph ? "graph" : "sequence"}`;
  const [settled, setSettled] = useState<string>();

  const select = useCallback((n: number | null) => go({ ...place, step: n }, { replace: true }), [place]);
  const selectAt = useCallback((i: number) => select(steps[Math.max(0, Math.min(steps.length - 1, i))]?.n ?? null), [select, steps]);
  const next = useCallback(() => selectAt(index < 0 ? 0 : index + 1), [selectAt, index]);
  const previous = useCallback(() => selectAt(index < 0 ? 0 : index - 1), [selectAt, index]);

  const play = useCallback(() => {
    if (playing) return setPlaying(false);
    if (index < 0 || index === steps.length - 1) selectAt(0);
    setPlaying(steps.length > 1);
  }, [playing, index, steps.length, selectAt]);

  // While playing, each Step stays about PLAY_MS; playback stops on the last one.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const at = index + 1;
      selectAt(at);
      if (at >= steps.length - 1) setPlaying(false);
    }, PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, steps.length, selectAt]);

  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") play();
      else if (e.key === "j" || e.key === "ArrowDown") next();
      else if (e.key === "k" || e.key === "ArrowUp") previous();
      else if (e.key === "Escape") {
        setPlaying(false);
        select(null);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, play, next, previous, select]);

  // The outline keeps the selected Step in view.
  useEffect(() => {
    if (step) document.querySelector(`.arc-outline [data-step="${step.n}"]`)?.scrollIntoView({ block: "nearest" });
  }, [step]);

  const ready = settled === fitKey;
  return (
    <div className="arc-dynamic">
      <aside className="arc-dyn-left" aria-label="Walkthrough">
        <div className="arc-transport" role="group" aria-label="Transport">
          <div className="arc-transport-buttons">
            <button type="button" aria-label="First Step" onClick={() => selectAt(0)}>
              <Icon name="first" />
            </button>
            <button type="button" aria-label="Previous Step" onClick={previous}>
              <Icon name="previous" />
            </button>
            <button type="button" className="arc-play" aria-label={playing ? "Pause" : "Play"} onClick={play}>
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button type="button" aria-label="Next Step" onClick={next}>
              <Icon name="next" />
            </button>
          </div>
          <p className="arc-transport-count" aria-live="polite">
            {step ? `Step ${step.n} of ${steps.length}` : `${steps.length} Steps`}
          </p>
          <div className="arc-progress" role="group" aria-label="Progress">
            <span className="arc-progress-fill" style={{ width: `${steps.length === 0 ? 0 : ((index + 1) / steps.length) * 100}%` }} />
            {steps.map((s) => (
              <button key={s.n} type="button" className="arc-tick" aria-label={`Go to Step ${s.n}`} aria-current={s.n === step?.n ? "step" : undefined} onClick={() => select(s.n)} />
            ))}
          </div>
        </div>
        <ol className="arc-outline" aria-label="Steps">
          {steps.map((s) => (
            <li key={s.n}>
              <button type="button" data-step={s.n} aria-current={s.n === step?.n ? "step" : undefined} onClick={() => select(s.n)}>
                <span className="arc-outline-n">{s.n}</span>
                <span className="arc-outline-text">
                  <span className="arc-outline-label">{s.description}</span>
                  <span className="arc-outline-ends">
                    {workspace.name(s.from)} <Glyph style={STYLE_OF(s)} /> {workspace.name(s.to)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <section className="arc-dyn-main" aria-label="Chart">
        <header className="arc-location">
          <div className="arc-dyn-title">
            <span className="arc-panel-kind">Dynamic View</span>
            <h1>{view.title}</h1>
          </div>
          <div className="arc-tools">
            <label className="arc-check">
              <input type="checkbox" checked={place.brokers} onChange={(e) => go({ ...place, brokers: e.target.checked }, { replace: true })} />
              Show brokers
            </label>
            <div className="arc-segmented" role="group" aria-label="Chart">
              {(["Sequence", "Graph"] as const).map((mode) => (
                <button key={mode} type="button" aria-pressed={(mode === "Graph") === place.graph} onClick={() => go({ ...place, graph: mode === "Graph" }, { replace: true })}>
                  {mode}
                </button>
              ))}
            </div>
            <RecentMenu />
            <CopyLink />
          </div>
        </header>
        <div className="arc-canvas" data-canvas data-state={ready ? "ready" : "busy"}>
          {place.graph ? (
            <StepGraph key={fitKey} workspace={workspace} view={view} brokers={place.brokers} fitKey={fitKey} selected={step?.n ?? null} onSelect={select} onSettled={setSettled} />
          ) : (
            <SequenceChart
              key={fitKey}
              workspace={workspace}
              layout={layout}
              fitKey={fitKey}
              selected={step?.n ?? null}
              playing={playing}
              reducedMotion={reducedMotion}
              onSelect={select}
              onSettled={setSettled}
            />
          )}
        </div>
      </section>
      <aside className="arc-dyn-detail" aria-label="Step detail">
        {step ? (
          <StepDetail workspace={workspace} view={view} step={step} onOpenStepView={onOpenStepView} onOpenView={onOpenView} />
        ) : (
          <Summary workspace={workspace} view={view} />
        )}
      </aside>
    </div>
  );
}

function Glyph({ style }: { style: MessageStyle }) {
  return <span className={`arc-glyph arc-step-${style}`} aria-label={STYLE_NAME[style]} role="img" />;
}

const KIND_NAME: Record<ResolvedStep["kind"], string> = { call: "Call", return: "Return", event: "Event" };

/** The selected Step: what happens, its Relationship, and where else it shows. */
function StepDetail({ workspace, view, step, onOpenStepView, onOpenView }: { workspace: Workspace; view: ResolvedDynamicView; step: ResolvedStep } & Pick<DynamicScreenProps, "onOpenStepView" | "onOpenView">) {
  const r = step.relationship;
  const owner = workspace.byId.get(r.from)?.owner;
  const team = owner ? workspace.teams.get(owner) : undefined;
  const others = dynamicViewsUsing(workspace.bundle, step.relationship).filter((v) => v.id !== view.id);
  return (
    <div className="arc-panel-body">
      <h2>Step {step.n}</h2>
      <p className="arc-panel-kind">{KIND_NAME[step.kind]}</p>
      <p className="arc-description">{step.description}</p>
      <p className="arc-outline-ends">
        {workspace.name(step.from)} <Glyph style={STYLE_OF(step)} /> {workspace.name(step.to)}
      </p>
      {step.note && <p className="arc-note">{step.note}</p>}
      <h3>Relationship</h3>
      <dl className="arc-facts">
        <dt>Id</dt>
        <dd>
          <code>{r.id ?? `${r.from} → ${r.to}`}</code>
        </dd>
        {r.description && (
          <>
            <dt>Description</dt>
            <dd>{r.description}</dd>
          </>
        )}
        <dt>Interaction</dt>
        <dd>{r.interaction}</dd>
        {r.technology && (
          <>
            <dt>Technology</dt>
            <dd>{r.technology}</dd>
          </>
        )}
        {r.via && (
          <>
            <dt>Via</dt>
            <dd>
              {workspace.name(r.via)}
              {r.channel && ` · ${r.channel}`}
            </dd>
          </>
        )}
        {owner && (
          <>
            <dt>Owner</dt>
            <dd>
              <span className="arc-owner-code arc-code-tile" style={{ "--team": team?.color } as CSSProperties}>
                {team?.code}
              </span>{" "}
              {workspace.name(owner)}
            </dd>
          </>
        )}
      </dl>
      <h3 id="arc-open-in">Open in</h3>
      <ul className="arc-view-links" aria-labelledby="arc-open-in">
        {stepViews(workspace.bundle, step).map((v) => (
          <li key={v}>
            <button type="button" className="arc-link" onClick={() => onOpenStepView(v, step)}>
              {workspace.title(v) ?? v}
            </button>
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <>
          <h3 id="arc-also-in">Also in</h3>
          <ul className="arc-view-links" aria-labelledby="arc-also-in">
            {others.map((v) => (
              <li key={v.id}>
                <button type="button" className="arc-link" onClick={() => onOpenView(v.id)}>
                  {v.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** With no Step selected: the View, its participants and the legend. */
function Summary({ workspace, view }: { workspace: Workspace; view: ResolvedDynamicView }) {
  const description = workspace.description(view.id);
  return (
    <div className="arc-panel-body">
      <h2>{view.title}</h2>
      <p className="arc-panel-kind">Dynamic View</p>
      {description && <p className="arc-description">{description}</p>}
      <p className="arc-muted">
        {view.steps.length} Steps across {view.participants.length} participants. Press Space to play, J and K to step, Esc to clear.
      </p>
      <h3 id="arc-participants">Participants</h3>
      <ul aria-labelledby="arc-participants">
        {view.participants.map((p) => (
          <li key={p}>{workspace.name(p)}</li>
        ))}
      </ul>
      <h3 id="arc-legend">Legend</h3>
      <ul className="arc-legend" aria-labelledby="arc-legend">
        {(["sync", "async", "return"] as const).map((s) => (
          <li key={s}>
            <Glyph style={s} /> {STYLE_NAME[s]}
          </li>
        ))}
        <li>
          <span className="arc-legend-bar" aria-hidden="true" /> Busy with a sync call
        </li>
      </ul>
    </div>
  );
}
