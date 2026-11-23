import { useMemo, type ReactNode } from "react";
import type { BundleAdr } from "../../src/schema/bundle.ts";
import { Markdown } from "./markdown.tsx";
import type { Workspace } from "./workspace.ts";
import { Icon } from "./Icon.tsx";

const LABELS: Record<BundleAdr["status"], string> = { proposed: "Proposed", accepted: "Accepted", rejected: "Rejected", deprecated: "Deprecated", superseded: "Superseded" };

/** An ADR status as a labelled badge, coloured by status but never by colour alone. */
export function AdrStatusBadge({ status }: { status: BundleAdr["status"] }) {
  return (
    <span className="arc-adr-status" data-status={status}>
      {LABELS[status]}
    </span>
  );
}

export interface AdrReaderProps {
  workspace: Workspace;
  id: string;
  /** Whether the Element panel is open beside the reader. */
  beside: boolean;
  onClose: () => void;
  onOpenAdr: (id: string) => void;
  onFocus: (id: string) => void;
  onOpenView: (id: string) => void;
}

/**
 * One ADR: its status (and effective status once superseded), date, people,
 * links to the Elements and Saved Views it covers, the ADRs it supersedes or
 * is superseded by, and its rendered body.
 */
export function AdrReader({ workspace, id, beside, onClose, onOpenAdr, onFocus, onOpenView }: AdrReaderProps) {
  const adrs = useMemo(() => new Map(workspace.bundle.adrs.map((a) => [a.id, a])), [workspace]);
  const adr = adrs.get(id);
  const className = `arc-reader${beside ? " arc-reader-beside" : ""}`;
  const close = (
    <button type="button" className="arc-reader-close" aria-label="Close ADR" onClick={onClose}>
      <Icon name="close" />
    </button>
  );
  if (!adr) {
    return (
      <article className={className} aria-label="ADR">
        <header className="arc-reader-head">
          {close}
          <p className="arc-empty">No ADR {id} in this Workspace.</p>
        </header>
      </article>
    );
  }

  const adrLink = (other: string) => (
    <button key={other} type="button" className="arc-link" onClick={() => onOpenAdr(other)}>
      <code>{other}</code> {adrs.get(other)?.title ?? ""}
    </button>
  );
  const elementLink = (ref: string) => {
    if (workspace.byId.has(ref))
      return (
        <button key={ref} type="button" className="arc-link" onClick={() => onFocus(ref)}>
          {workspace.name(ref)}
        </button>
      );
    const target = workspace.bundle.targets.find((t) => t.id === ref);
    return (
      <span key={ref} title={ref}>
        {target ? `${target.name} (${target.kind})` : ref}
      </span>
    );
  };
  const viewLink = (view: string) => (
    <button key={view} type="button" className="arc-link" onClick={() => onOpenView(view)}>
      {workspace.title(view) ?? view}
    </button>
  );
  const superseded = adr.effectiveStatus !== adr.status;

  return (
    <article className={className} aria-label="ADR">
      <header className="arc-reader-head">
        {close}
        <h2>{adr.title}</h2>
        <code className="arc-panel-id">{adr.id}</code>
      </header>
      <div className="arc-reader-body">
        {adr.supersededBy.length > 0 && (
          <p className="arc-reader-banner" role="status">
            Superseded by {join(adr.supersededBy.map(adrLink), " ")}
          </p>
        )}
        <dl className="arc-facts">
          <dt>Status</dt>
          <dd>
            <AdrStatusBadge status={adr.effectiveStatus} />
            {superseded && <span className="arc-muted"> (written as {LABELS[adr.status]})</span>}
          </dd>
          <dt>Date</dt>
          <dd>
            <time dateTime={adr.date}>{adr.date}</time>
          </dd>
          {fact("Decision makers", adr.decisionMakers)}
          {fact("Consulted", adr.consulted)}
          {fact("Informed", adr.informed)}
          {fact("Tags", adr.tags)}
          {fact("Elements", adr.elements.map(elementLink), " ")}
          {fact("Views", adr.views.map(viewLink), " ")}
          {fact("Supersedes", adr.supersedes.map(adrLink), " ")}
          {fact("Superseded by", adr.supersededBy.map(adrLink), " ")}
        </dl>
        <section className="arc-markdown" role="region" aria-label="Decision">
          <Markdown source={withoutTitle(adr.body, adr.title)} shift={1} />
        </section>
        <p className="arc-muted arc-reader-source">{adr.source.file}</p>
      </div>
    </article>
  );
}

/** A term and its values, comma-separated unless they are links; nothing when there are none. */
function fact(term: string, values: ReactNode[], separator = ", ") {
  if (values.length === 0) return null;
  return (
    <>
      <dt>{term}</dt>
      <dd>{join(values, separator)}</dd>
    </>
  );
}

const join = (nodes: ReactNode[], separator: string) => nodes.flatMap((n, i) => (i === 0 ? [n] : [separator, n]));

/** The body without its leading `# ` title, which the reader already shows. */
function withoutTitle(body: string, title: string): string {
  const match = /^\s*#\s+(.*?)\s*#*\s*(\n|$)/.exec(body);
  return match && match[1] === title ? body.slice(match[0].length) : body;
}
