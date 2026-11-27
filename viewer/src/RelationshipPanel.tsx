import type { ViewEdge } from "../../src/core/views/index.ts";
import type { BundleRelationship } from "../../src/schema/bundle.ts";
import { Icon } from "./Icon.tsx";
import type { Workspace } from "./workspace.ts";

export interface RelationshipPanelProps {
  workspace: Workspace;
  edge: ViewEdge;
  /** The names of the boxes at the edge's two ends, as the canvas draws them. */
  fromName: string;
  toName: string;
  /** Selects one of the edge's end nodes on the canvas. */
  onSelectNode: (id: string) => void;
  /** Focuses an Element, as the Element panel's links do. */
  onFocus: (id: string) => void;
  onClose: () => void;
}

const CHANGE_LABEL = { added: "Added in this comparison", removed: "Removed in this comparison", changed: "Changed in this comparison" } as const;

/**
 * Everything about the selected edge: the Relationships declared beneath it. An edge between
 * collapsed boxes stands for every Relationship between what they hold, so each is listed with its own ends.
 */
export function RelationshipPanel({ workspace, edge, fromName, toName, onSelectNode, onFocus, onClose }: RelationshipPanelProps) {
  const count = edge.relationships.length;
  // A single Relationship drawn between its own two Elements needs no ends of its own: the title already names them.
  const direct = count === 1 && edge.relationships[0]!.from === edge.from && edge.relationships[0]!.to === edge.to;
  return (
    <aside className="arc-panel arc-rel-panel" aria-label="Relationship">
      <header className="arc-panel-head">
        <div className="arc-panel-title">
          <h2 className="arc-rel-title">
            <button type="button" className="arc-rel-end" title={`Select ${fromName}`} onClick={() => onSelectNode(edge.from)}>
              {fromName}
            </button>
            <Icon name="arrow" className="arc-rel-arrow" />
            <button type="button" className="arc-rel-end" title={`Select ${toName}`} onClick={() => onSelectNode(edge.to)}>
              {toName}
            </button>
          </h2>
          <p className="arc-panel-kind">
            Relationship{count === 1 ? "" : ` · ${count} declared`}
          </p>
        </div>
        <button type="button" className="arc-flyout-close" aria-label="Close panel" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="arc-panel-body">
        {edge.change && edge.change !== "unchanged" && <p className={`arc-rel-change arc-${edge.change}`}>{CHANGE_LABEL[edge.change]}</p>}
        {!direct && count > 0 && <p className="arc-muted arc-rel-note">This edge stands for every Relationship between what these two boxes hold.</p>}
        {count === 0 && <p className="arc-empty">No Relationships are declared beneath this edge.</p>}
        <ul className="arc-rel-list">
          {edge.relationships.map((r, i) => (
            <li key={r.id ?? `${r.source.file}:${r.source.line}:${i}`}>
              <Relationship workspace={workspace} relationship={r} showEnds={!direct} onFocus={onFocus} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Relationship({ workspace, relationship: r, showEnds, onFocus }: { workspace: Workspace; relationship: BundleRelationship; showEnds: boolean; onFocus: (id: string) => void }) {
  const link = (id: string) => (
    <button type="button" className="arc-link" onClick={() => onFocus(id)}>
      {workspace.name(id)}
    </button>
  );
  return (
    <section className="arc-rel" role="region" aria-label={`${workspace.name(r.from)} to ${workspace.name(r.to)}`}>
      {showEnds && (
        <h3 className="arc-rel-ends">
          {link(r.from)}
          <span aria-label="to">→</span>
          {link(r.to)}
        </h3>
      )}
      {r.description ? <p className="arc-description">{r.description}</p> : <p className="arc-empty">No description.</p>}
      <dl className="arc-facts">
        {r.technology && <Fact term="Technology">{r.technology}</Fact>}
        <Fact term="Interaction">{r.interaction === "async" ? "Asynchronous" : "Synchronous"}</Fact>
        {r.via && <Fact term="Via">{link(r.via)}</Fact>}
        {r.channel && (
          <Fact term="Channel">
            <code>{r.channel}</code>
          </Fact>
        )}
        {r.tags.length > 0 && (
          <Fact term="Tags">
            <span className="arc-rel-tags">
              {r.tags.map((t) => (
                <span key={t} className="arc-rel-tag">
                  {t}
                </span>
              ))}
            </span>
          </Fact>
        )}
        {r.id && (
          <Fact term="Id">
            <code className="arc-panel-id">{r.id}</code>
          </Fact>
        )}
        <Fact term="Declared in">
          <code className="arc-panel-id">
            {r.source.file}:{r.source.line}
          </code>
        </Fact>
      </dl>
    </section>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}
