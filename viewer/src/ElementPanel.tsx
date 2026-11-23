import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { listAdrs } from "../../src/core/adrs.ts";
import { getDeployments } from "../../src/core/deployments.ts";
import { getImpact, type ImpactRing } from "../../src/core/impact.ts";
import type { BundleRelationship } from "../../src/schema/bundle.ts";
import type { Comparison } from "./App.tsx";
import { AdrStatusBadge } from "./AdrReader.tsx";
import { RevisionSummary } from "./History.tsx";
import type { Lens, Place } from "./place.ts";
import { pointLabel, type Timeline } from "./revisions.ts";
import type { Workspace } from "./workspace.ts";
import { Icon } from "./Icon.tsx";

type Tab = "Overview" | "URLs" | "ADRs" | "Links" | "History";
const TABS: readonly Tab[] = ["Overview", "URLs", "ADRs", "Links", "History"];

export interface ElementPanelProps {
  workspace: Workspace;
  id: string;
  onLens: (lens: Lens) => void;
  onConnect: (from: string) => void;
  onFocus: (id: string) => void;
  onOpenView: (id: string) => void;
  onOpenAdr: (id: string) => void;
  /** Opens an Environment's Deployment View with these nodes marked. */
  onDeployed: (view: string, nodes: string[]) => void;
  timeline: Timeline;
  comparison: Comparison | undefined;
  onTime: (time: Pick<Place, "at" | "vs">) => void;
  /** Clears the selection, which closes the panel. */
  onClose?: () => void;
}

/** Everything about the selected Element: Overview with the persona actions, URLs per Environment, its ADRs, Links and its History. */
export function ElementPanel({ workspace, id, onLens, onConnect, onFocus, onOpenView, onOpenAdr, onDeployed, timeline, comparison, onTime, onClose }: ElementPanelProps) {
  const [tab, setTab] = useState<Tab>("Overview");
  // Counts beside the ADRs and Links tabs, as the prototype shows them.
  const counts = useMemo<Partial<Record<Tab, number>>>(
    () => ({
      ADRs: listAdrs(workspace.bundle, { element: id }).length,
      Links: workspace.bundle.relationships.filter((r) => r.from === id || r.to === id).length,
    }),
    [workspace, id],
  );
  const element = workspace.byId.get(id);
  if (!element) return null;
  const team = workspace.teams.get(element.owner);
  const technology = "technology" in element ? element.technology : null;
  const kindLabel = (element.kind === "system" || element.kind === "service") && element.external ? `External ${element.kind}` : element.kind[0]!.toUpperCase() + element.kind.slice(1);

  return (
    <aside className="arc-panel" aria-label="Element">
      <header className="arc-panel-head">
        <div className="arc-panel-title">
          <h2>{element.name}</h2>
          <p className="arc-panel-kind">
            {kindLabel} · <code className="arc-panel-id">{element.id}</code>
          </p>
          <button type="button" className="arc-owner" aria-label={`Team lens: ${workspace.name(element.owner)}`} style={{ "--team": team?.color } as CSSProperties} onClick={() => onLens({ team: element.owner })}>
            <span className="arc-owner-code">{team?.code}</span>
            <span className="arc-owner-name">{workspace.name(element.owner)}</span>
          </button>
        </div>
        {onClose && (
          <button type="button" className="arc-flyout-close" aria-label="Close panel" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <div className="arc-tabs" role="tablist" aria-label="Element">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
            {counts[t] !== undefined && <span className="arc-tab-count"> {counts[t]}</span>}
          </button>
        ))}
      </div>
      <div className="arc-panel-body" role="tabpanel" aria-label={tab}>
        {tab === "Overview" && (
          <>
            {comparison && <Compared comparison={comparison} id={id} />}
            {(element.description || technology) && (
              <p className="arc-description">
                {element.description}
                {technology && <span className="arc-technology"> {technology}</span>}
              </p>
            )}
            <section className="arc-actions" aria-label="Ask">
              <button type="button" className="arc-action" aria-label="Both ways impact" onClick={() => onLens({ impact: id, direction: "both" })}>
                <Icon name="impact" />
                Upstream &amp; downstream
              </button>
              <button type="button" className="arc-action" title="Lights the paths to the node you pick next, and picks every node on them" onClick={() => onConnect(id)}>
                <Icon name="connect" />
                Connect to…
              </button>
              {workspace.ownView(id) !== undefined && (
                <button type="button" className="arc-action" onClick={() => onOpenView(id)}>
                  <Icon name="open" />
                  Open its View
                </button>
              )}
            </section>
            {element.kind === "service" && <WhereDeployed workspace={workspace} id={id} onDeployed={onDeployed} />}
          </>
        )}
        {tab === "URLs" && <Urls workspace={workspace} id={id} />}
        {tab === "ADRs" && <Adrs workspace={workspace} id={id} onOpen={onOpenAdr} />}
        {tab === "Links" && <Links workspace={workspace} id={id} onFocus={onFocus} />}
        {tab === "History" && <History workspace={workspace} id={id} timeline={timeline} onTime={onTime} />}
      </div>
    </aside>
  );
}

/** "Where is it deployed?": one button per Environment the Service runs in, opening its Deployment View with the Service's Deployments marked. */
function WhereDeployed({ workspace, id, onDeployed }: { workspace: Workspace; id: string; onDeployed: (view: string, nodes: string[]) => void }) {
  const places = useMemo(() => workspace.deployedIn(id), [workspace, id]);
  return (
    <section className="arc-actions" role="region" aria-label="Where is it deployed?">
      <h3>Where is it deployed?</h3>
      {places.length === 0 ? (
        <p className="arc-empty">Not deployed in any Environment.</p>
      ) : (
        <div className="arc-deployed">
          {places.map((p) => (
            <button key={p.environment} type="button" className="arc-action" onClick={() => onDeployed(p.view, p.nodes)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Each Environment's Deployments, with the Deployment Target chain, the URL and named endpoints, each with a copy button. */
function Urls({ workspace, id }: { workspace: Workspace; id: string }) {
  const deployments = useMemo(() => getDeployments(workspace.bundle, id), [workspace, id]);
  if (deployments.length === 0) return <p className="arc-empty">No Deployments.</p>;
  const environments = workspace.bundle.environments.filter((env) => deployments.some((d) => d.environment === env.id));
  return (
    <>
      {environments.map((env) => (
        <section key={env.id} className="arc-env" role="region" aria-label={env.name}>
          <h3>{env.name}</h3>
          <ul>
            {deployments
              .filter((d) => d.environment === env.id)
              .map((d) => (
                <li key={d.target}>
                  <div className="arc-target">{d.targetPath.map((t) => t.name).join(" › ") || d.target}</div>
                  {d.url ? <UrlRow url={d.url} /> : <p className="arc-empty">No URL</p>}
                  {d.endpoints.map((e) => (
                    <UrlRow key={e.name} name={e.name} url={e.url} />
                  ))}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function UrlRow({ name, url }: { name?: string; url: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <div className="arc-url">
      {name && <span className="arc-endpoint">{name}</span>}
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
      <button type="button" className="arc-copy" aria-label={`Copy ${url}`} onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** The ADRs linking the Element or its descendants, as `list_adrs(element)` gives them: newest first, superseded ones marked. */
function Adrs({ workspace, id, onOpen }: { workspace: Workspace; id: string; onOpen: (adr: string) => void }) {
  const adrs = useMemo(() => listAdrs(workspace.bundle, { element: id }), [workspace, id]);
  if (adrs.length === 0) return <p className="arc-empty">No ADRs link this Element or anything inside it.</p>;
  return (
    <ul className="arc-adr-list">
      {adrs.map((a) => (
        <li key={a.id} data-superseded={a.effectiveStatus === "superseded" ? "true" : undefined}>
          <button type="button" className="arc-adr-row" onClick={() => onOpen(a.id)}>
            <code className="arc-adr-id">{a.id}</code>
            <span className="arc-adr-title">{a.title}</span>
            <AdrStatusBadge status={a.effectiveStatus} />
            <time className="arc-muted" dateTime={a.date}>
              {a.date}
            </time>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The Element's own Relationships, then everything Downstream and Upstream of it by distance. */
function Links({ workspace, id, onFocus }: { workspace: Workspace; id: string; onFocus: (id: string) => void }) {
  const impact = useMemo(() => getImpact(workspace.bundle, id, "both"), [workspace, id]);
  const own = workspace.bundle.relationships.filter((r) => r.from === id || r.to === id);
  const link = (target: string) => (
    <button type="button" className="arc-link" onClick={() => onFocus(target)}>
      {workspace.name(target)}
    </button>
  );
  const rel = (r: BundleRelationship, i: number) => (
    <li key={i}>
      {r.from === id ? "→ " : "← "}
      {link(r.from === id ? r.to : r.from)}
      {r.description && <span className="arc-muted"> {r.description}</span>}
      {r.technology && <span className="arc-muted"> · {r.technology}</span>}
    </li>
  );
  const rings = (label: string, list: ImpactRing[] | undefined) => (
    <section role="region" aria-label={label}>
      <h3>{label}</h3>
      {!list?.length && <p className="arc-empty">Nothing</p>}
      <ul>
        {list?.flatMap((ring) =>
          ring.elements.map((e) => (
            <li key={e.id}>
              <span className="arc-distance-inline">{ring.distance}</span> {link(e.id)}
            </li>
          )),
        )}
      </ul>
    </section>
  );
  return (
    <>
      <section role="region" aria-label="Relationships">
        <h3>Relationships</h3>
        {own.length === 0 && <p className="arc-empty">None declared here</p>}
        <ul>{own.map(rel)}</ul>
      </section>
      {rings("Downstream", impact.downstream)}
      {rings("Upstream", impact.upstream)}
    </>
  );
}

/** How the selected Element changed in the comparison on screen: its fields before and after, or that it was added or removed. */
function Compared({ comparison, id }: { comparison: Comparison; id: string }) {
  const change = comparison.changes.find((c) => c.kind === "element" && c.id === id);
  if (!change) return null;
  const show = (value: unknown) => (value === undefined ? "—" : JSON.stringify(value));
  return (
    <section className="arc-compared" role="region" aria-label="Changed in this comparison">
      <h3>{change.type === "changed" ? `Changed, ${comparison.label}` : `${change.type === "added" ? "Added" : "Removed"}, ${comparison.label}`}</h3>
      {change.type === "changed" && (
        <dl className="arc-fields">
          {change.fields.map((field) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd>
                {show(change.before?.[field])} → {show(change.after?.[field])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/**
 * The Revisions that changed the Element or anything inside it, newest first,
 * from the site's Revision index. Each opens Compare between it and the
 * Revision before.
 */
function History({ workspace, id, timeline, onTime }: { workspace: Workspace; id: string; timeline: Timeline; onTime: (time: Pick<Place, "at" | "vs">) => void }) {
  const revisions = useMemo(() => {
    const ids = new Set<string>();
    const add = (e: string) => {
      ids.add(e);
      for (const child of workspace.children(e)) add(child.id);
    };
    add(id);
    return timeline.touching(ids);
  }, [workspace, id, timeline]);
  if (timeline.revisions.length === 0) return <p className="arc-empty">This site has no history.</p>;
  if (revisions.length === 0) return <p className="arc-empty">No Revision changed it.</p>;
  return (
    <ul className="arc-history-list">
      {revisions.map((r) => {
        const previous = timeline.previous(r);
        const at = timeline.isLatest(r) ? null : pointLabel(r);
        return (
          <li key={r.sha}>
            <RevisionSummary revision={r} />
            {previous ? (
              <button type="button" aria-label={`Compare ${pointLabel(previous)} → ${pointLabel(r)}`} onClick={() => onTime({ at, vs: pointLabel(previous) })}>
                Compare
              </button>
            ) : (
              <button type="button" aria-label={`Open ${pointLabel(r)}`} onClick={() => onTime({ at, vs: null })}>
                Open
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
