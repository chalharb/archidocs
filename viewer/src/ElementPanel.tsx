import { useEffect, useMemo, useState } from "react";
import { getDeployments } from "../../src/core/deployments.ts";
import { getImpact, type ImpactRing } from "../../src/core/impact.ts";
import type { BundleRelationship } from "../../src/schema/bundle.ts";
import type { ImpactWay, Lens } from "./place.ts";
import { GLYPHS, type Workspace } from "./workspace.ts";

type Tab = "Overview" | "URLs" | "Links";
const TABS: readonly Tab[] = ["Overview", "URLs", "Links"];

export interface ElementPanelProps {
  workspace: Workspace;
  id: string;
  onLens: (lens: Lens) => void;
  onConnect: (from: string) => void;
  onFocus: (id: string) => void;
  onOpenView: (id: string) => void;
}

/** Everything about the selected Element: Overview with the persona actions, URLs per Environment, and Links. */
export function ElementPanel({ workspace, id, onLens, onConnect, onFocus, onOpenView }: ElementPanelProps) {
  const [tab, setTab] = useState<Tab>("Overview");
  const element = workspace.byId.get(id);
  if (!element) return null;
  const team = workspace.teams.get(element.owner);
  const technology = "technology" in element ? element.technology : null;

  return (
    <aside className="ad-panel" aria-label="Element">
      <header className="ad-panel-head">
        <span className="ad-panel-kind" data-glyph={GLYPHS[element.kind]}>
          {element.kind === "system" || element.kind === "service" ? (element.external ? `External ${element.kind}` : element.kind) : element.kind}
        </span>
        <h2>{element.name}</h2>
        <code className="ad-panel-id">{element.id}</code>
      </header>
      <div className="ad-tabs" role="tablist" aria-label="Element">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="ad-panel-body" role="tabpanel" aria-label={tab}>
        {tab === "Overview" && (
          <>
            {element.description && <p className="ad-description">{element.description}</p>}
            <dl className="ad-facts">
              {technology && (
                <>
                  <dt>Technology</dt>
                  <dd>{technology}</dd>
                </>
              )}
              <dt>Owner</dt>
              <dd>
                <button type="button" className="ad-owner" aria-label={`Team lens: ${workspace.name(element.owner)}`} style={{ borderColor: team?.color }} onClick={() => onLens({ team: element.owner })}>
                  <span className="ad-owner-code">{team?.code}</span> {workspace.name(element.owner)}
                </button>
              </dd>
            </dl>
            <section className="ad-actions" aria-label="Ask">
              <h3>Impact</h3>
              <div className="ad-segmented" role="group" aria-label="Impact">
                {(["upstream", "both", "downstream"] as const satisfies readonly ImpactWay[]).map((way) => (
                  <button key={way} type="button" aria-label={`${way === "both" ? "Both ways" : way[0]!.toUpperCase() + way.slice(1)} impact`} onClick={() => onLens({ impact: id, direction: way })}>
                    {way === "both" ? "Both" : way === "upstream" ? "Upstream" : "Downstream"}
                  </button>
                ))}
              </div>
              <button type="button" className="ad-action" onClick={() => onConnect(id)}>
                Connect to…
              </button>
              {workspace.ownView(id) !== undefined && (
                <button type="button" className="ad-action" onClick={() => onOpenView(id)}>
                  Open its View
                </button>
              )}
            </section>
          </>
        )}
        {tab === "URLs" && <Urls workspace={workspace} id={id} />}
        {tab === "Links" && <Links workspace={workspace} id={id} onFocus={onFocus} />}
      </div>
    </aside>
  );
}

/** Each Environment's Deployments, with the Deployment Target chain, the URL and named endpoints, each with a copy button. */
function Urls({ workspace, id }: { workspace: Workspace; id: string }) {
  const deployments = useMemo(() => getDeployments(workspace.bundle, id), [workspace, id]);
  if (deployments.length === 0) return <p className="ad-empty">No Deployments.</p>;
  const environments = workspace.bundle.environments.filter((env) => deployments.some((d) => d.environment === env.id));
  return (
    <>
      {environments.map((env) => (
        <section key={env.id} className="ad-env" role="region" aria-label={env.name}>
          <h3>{env.name}</h3>
          <ul>
            {deployments
              .filter((d) => d.environment === env.id)
              .map((d) => (
                <li key={d.target}>
                  <div className="ad-target">{d.targetPath.map((t) => t.name).join(" › ") || d.target}</div>
                  {d.url ? <UrlRow url={d.url} /> : <p className="ad-empty">No URL</p>}
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
    <div className="ad-url">
      {name && <span className="ad-endpoint">{name}</span>}
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
      <button type="button" className="ad-copy" aria-label={`Copy ${url}`} onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** The Element's own Relationships, then everything Downstream and Upstream of it by distance. */
function Links({ workspace, id, onFocus }: { workspace: Workspace; id: string; onFocus: (id: string) => void }) {
  const impact = useMemo(() => getImpact(workspace.bundle, id, "both"), [workspace, id]);
  const own = workspace.bundle.relationships.filter((r) => r.from === id || r.to === id);
  const link = (target: string) => (
    <button type="button" className="ad-link" onClick={() => onFocus(target)}>
      {workspace.name(target)}
    </button>
  );
  const rel = (r: BundleRelationship, i: number) => (
    <li key={i}>
      {r.from === id ? "→ " : "← "}
      {link(r.from === id ? r.to : r.from)}
      {r.description && <span className="ad-muted"> {r.description}</span>}
      {r.technology && <span className="ad-muted"> · {r.technology}</span>}
    </li>
  );
  const rings = (label: string, list: ImpactRing[] | undefined) => (
    <section role="region" aria-label={label}>
      <h3>{label}</h3>
      {!list?.length && <p className="ad-empty">Nothing</p>}
      <ul>
        {list?.flatMap((ring) =>
          ring.elements.map((e) => (
            <li key={e.id}>
              <span className="ad-distance-inline">{ring.distance}</span> {link(e.id)}
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
        {own.length === 0 && <p className="ad-empty">None declared here</p>}
        <ul>{own.map(rel)}</ul>
      </section>
      {rings("Downstream", impact.downstream)}
      {rings("Upstream", impact.upstream)}
    </>
  );
}
