import { useEffect, useMemo, useRef, useState } from "react";
import { search } from "../../src/core/search.ts";
import { GLYPHS, type Workspace } from "./workspace.ts";

const LIMIT = 30;

export interface FindProps {
  workspace: Workspace;
  /** Says what a pick does, such as "Pick the node to connect Web to". */
  prompt?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * Find (`/`): the core engine's `search` over name, id, Team, technology and
 * URL, the same function MCP's `search_elements` runs. Enter picks the first
 * result; Escape closes.
 */
export function Find({ workspace, prompt, onPick, onClose }: FindProps) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (query.trim() ? search(workspace.bundle, query, { fields: ["team", "technology"] }).slice(0, LIMIT) : []), [workspace, query]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="ad-scrim" onClick={onClose} />
      <section className="ad-flyout ad-find" role="dialog" aria-label="Find">
        <header className="ad-flyout-head">
          <h2>Find</h2>
          {prompt && <p className="ad-muted">{prompt}</p>}
        </header>
        <input
          ref={input}
          type="search"
          className="ad-find-input"
          placeholder="Name, id, Team, technology or URL"
          aria-label="Find"
          aria-controls="ad-find-results"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onPick(results[0].element.id);
          }}
        />
        <ul className="ad-results" id="ad-find-results" role="listbox" aria-label="Results">
          {results.map(({ element, deployment }) => {
            const team = workspace.teams.get(element.owner);
            return (
              <li key={element.id} role="option" aria-selected="false" tabIndex={-1} onClick={() => onPick(element.id)} onKeyDown={(e) => e.key === "Enter" && onPick(element.id)}>
                <span className="ad-result-name" data-glyph={GLYPHS[element.kind]}>
                  {element.name}
                </span>
                <code className="ad-muted">{element.id}</code>
                {team && (
                  <span className="ad-row-team" style={{ borderColor: team.color }}>
                    {team.code}
                  </span>
                )}
                {deployment && (
                  <span className="ad-result-url">
                    {workspace.name(deployment.environment)} · {deployment.url}
                  </span>
                )}
              </li>
            );
          })}
          {query.trim() && results.length === 0 && <li className="ad-empty">No matches</li>}
        </ul>
      </section>
    </>
  );
}
